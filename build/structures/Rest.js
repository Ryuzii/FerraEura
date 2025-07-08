const { fetch: undiciFetch, Response } = require("undici");
const { Agent } = require("undici");
const nodeUtil = require("node:util");

class Rest {
  constructor(tera, options) {
    this.tera = tera;
    // Use new nested structure for REST config
    this.url = `http${options.secure ? "s" : ""}://${options.host}:${options.port}`;
    console.log('[Rest.js] Creating Agent with origin:', this.url);
    this.sessionId = options.sessionId;
    this.password = options.password;
    this.version = (options.rest?.version || options.restVersion);
    this.retryCount = (options.rest?.retryCount || options.restRetryCount || 3);
    this.timeout = (options.rest?.timeout || options.restTimeout || 5000);
    try {
      this.agent = new Agent({
        pipelining: 1,
        connections: 100,
        tls: { rejectUnauthorized: false },
        connect: { timeout: 10000 },
        keepAliveTimeout: 60000,
        keepAliveMaxTimeout: 300000,
        allowH2: true,
        maxConcurrentStreams: 100,
        bodyTimeout: 30000,
        headersTimeout: 10000,
      });
    } catch (error) {
      this.tera.emit("debug", `Failed to create agent: ${error.message}, falling back to default`);
      this.agent = null;
    }
    this.pendingRequests = new Map();
    this.batchTimeout = null;
    this.batchDelay = 10;
    this.cache = new Map();
    this.cacheTimeout = 30000;
    this.trackCache = new Map();
    this.trackCacheTimeout = 300000;
    this.nodeInfoCache = new Map();
    this.nodeInfoCacheTimeout = 60000;
  }
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }
  async batchRequest(method, endpoint, body = null, includeHeaders = false) {
    const key = `${method}:${endpoint}:${JSON.stringify(body)}`;
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    const promise = this.makeRequest(method, endpoint, body, includeHeaders);
    this.pendingRequests.set(key, promise);
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
    return promise;
  }
  async makeRequest(method, endpoint, body = null, includeHeaders = false) {
    const startTime = Date.now();
    try {
      const headers = {
        'Authorization': this.password,
        'Content-Type': 'application/json',
        'User-Agent': `Teralink/${this.version}`
      };
      const requestOptions = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      };
      if (this.agent) requestOptions.dispatcher = this.agent;
      const response = await undiciFetch(this.url + endpoint, requestOptions);
      const responseTime = Date.now() - startTime;
      this.tera.emit(
        "debug",
        `[Rest] ${method} ${endpoint.startsWith("/") ? endpoint : `/${endpoint}`} ${body ? `body: ${JSON.stringify(body)}` : ""} -> Status: ${response.status} (${responseTime}ms)`
      );
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        this.tera.emit("debug", `[Rest Error] ${method} ${endpoint} failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Request failed'}`);
      }
      const data = await this.parseResponse(response);
      if (method === 'GET' && response.ok) {
        const cacheKey = `${method}:${endpoint}`;
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      return includeHeaders === true ? {
        data,
        headers: response.headers,
        responseTime
      } : data;
    } catch (error) {
      this.tera.emit("debug", `Request failed: ${error.message}`);
      throw error;
    }
  }
  async parseResponse(response) {
    try {
      if (response.status === 204) {
        return null;
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      this.tera.emit("debug", `[Rest - Error] Parse error: ${error.message}`);
      return null;
    }
  }
  async updatePlayer(options) {
    const { guildId, data } = options;
    return this.makeRequest(
      "PATCH",
      `/${this.version}/sessions/${this.sessionId}/players/${guildId}`,
      data
    );
  }
  async destroyPlayer(guildId) {
    return this.makeRequest(
      "DELETE",
      `/${this.version}/sessions/${this.sessionId}/players/${guildId}`
    );
  }
  async getPlayers() {
    return this.makeRequest(
      "GET",
      `/${this.version}/sessions/${this.sessionId}/players`
    );
  }
  async getTracks(identifier) {
    const cacheKey = `tracks:${identifier}`;
    const cached = this.trackCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.trackCacheTimeout) {
      this.tera.emit("debug", `[Rest Cache] Track cache hit for ${identifier}`);
      return cached.data;
    }
    const result = await this.makeRequest(
      "GET",
      `/${this.version}/loadtracks?identifier=${encodeURIComponent(identifier)}`
    );
    this.trackCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    return result;
  }
  async decodeTrack(track) {
    return this.makeRequest(
      "GET",
      `/${this.version}/decodetrack?encodedTrack=${encodeURIComponent(track)}`
    );
  }
  async decodeTracks(tracks) {
    return this.makeRequest(
      "POST",
      `/${this.version}/decodetracks`,
      { tracks }
    );
  }
  async getStats() {
    return this.makeRequest("GET", `/${this.version}/stats`);
  }
  async getInfo() {
    return this.makeRequest("GET", `/${this.version}/info`);
  }
  pruneCaches() {
    const now = Date.now();
    if (this.cache && this.cache instanceof Map) {
      for (const [key, value] of this.cache.entries()) {
        if (value.timestamp && (now - value.timestamp) > 30000) {
          this.cache.delete(key);
        }
      }
    }
    if (this.trackCache && this.trackCache instanceof Map) {
      for (const [key, value] of this.trackCache.entries()) {
        if (value.timestamp && (now - value.timestamp) > 30000) {
          this.trackCache.delete(key);
        }
      }
    }
    if (this.nodeInfoCache && this.nodeInfoCache instanceof Map) {
      for (const [key, value] of this.nodeInfoCache.entries()) {
        if (value.timestamp && (now - value.timestamp) > 30000) {
          this.nodeInfoCache.delete(key);
        }
      }
    }
  }
  destroy() {
    // Remove all event listeners and clear caches
    this.removeAllListeners && this.removeAllListeners();
    if (this.cache) this.cache.clear();
    if (this.trackCache) this.trackCache.clear();
    if (this.nodeInfoCache) this.nodeInfoCache.clear();
  }
}

module.exports = { Rest }; 