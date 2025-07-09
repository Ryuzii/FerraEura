// Tera.js - Next Generation Lavalink v4+ Super Performant Wrapper
const { EventEmitter } = require("tseep");
const fs = require("fs/promises");
const { Node } = require("./Node");
const { Player } = require("./Player");
const { Plugin } = require("./Plugin");
const { Status } = require("./Status"); // Add Status import
const { version: pkgVersion } = require("../../package.json"); // Expose package version
const SUPPORTED_VERSION = "v4";

/**
 * Teralink - Next Generation Lavalink v4+ Super Performant Wrapper
 * @class
 * @extends EventEmitter
 * @param {Client} client - Your Discord.js client
 * @param {Array} nodes - Lavalink node configs
 * @param {Object} options - Teralink options
 * @param {Function} options.send - Function to send payloads to Discord
 * @param {boolean|Object} [options.sync] - Enable voice status updates (default: false) or pass { template: '...' }
 * @param {boolean|Object} [options.setActivityStatus] - Enable bot activity status updates (default: false) or pass { template: '...' }
 * @param {boolean} [options.autoResume] - Enable autoResume functionality (default: false)
 * @param {number} [options.multipleTrackHistory] - Number of previous tracks to remember (default: 1)
 * @param {boolean} [options.lazyLoad] - Enable lazy loading for better performance (default: false)
 * @param {number} [options.lazyLoadTimeout] - Timeout for lazy loading in ms (default: 5000)
 * @param {string} [options.defaultSearchPlatform] - Default search platform (default: "ytmsearch")
 * @param {string} [options.restVersion] - Lavalink REST API version (default: "v4")
 * @param {Array} [options.plugins] - Array of Teralink plugins
 */
class Teralink extends EventEmitter {
  constructor(client, nodes, options = {}) {
    super();
    if (!client) throw new Error("Client is required to initialize Teralink");
    if (!Array.isArray(nodes)) throw new Error("Nodes must be an array");
    if (!options.send || typeof options.send !== "function") throw new Error("Send function is required");
    this.client = client;
    this.nodes = nodes;
    this.nodeMap = new Map();
    this.players = new Map();
    this.options = options;
    this.clientId = null;
    this.initiated = false;
    this.send = options.send;

    // --- Begin: New Options Structure Migration ---
    // Source
    this.source = options.source || { default: options.defaultSearchPlatform || "ytmsearch" };
    // REST
    this.rest = options.rest || {
      version: options.restVersion || SUPPORTED_VERSION,
      retryCount: options.restRetryCount || 3,
      timeout: options.restTimeout || 5000
    };
    // Plugins
    this.plugins = options.plugins || [];
    // Resume
    this.resume = options.resume || {
      key: options.resumeKey || "teralink-resume",
      timeout: options.resumeTimeout || 60_000
    };
    // Node
    this.node = options.node || {
      dynamicSwitching: options.dynamicNodeSwitching !== undefined ? options.dynamicNodeSwitching : true,
      autoReconnect: options.autoReconnectNodes !== undefined ? options.autoReconnectNodes : true,
      ws: {
        reconnectTries: options.wsReconnectTries || 5,
        reconnectInterval: options.wsReconnectInterval || 5000
      }
    };
    // Autopause
    this.autopauseOnEmpty = options.autopauseOnEmpty !== undefined ? options.autopauseOnEmpty : true;
    // Lazy Load
    this.lazyLoad = (options.lazyLoad && typeof options.lazyLoad === 'object') ? options.lazyLoad.enabled : (options.lazyLoad || false);
    this.lazyLoadTimeout = (options.lazyLoad && typeof options.lazyLoad === 'object') ? options.lazyLoad.timeout : (options.lazyLoadTimeout || 5000);
    // Sync
    this.sync = options.sync;
    // --- End: New Options Structure Migration ---

    this.defaultSearchPlatform = this.source.default;
    this.restVersion = this.rest.version;
    this.tracks = [];
    this.resumeKey = this.resume.key;
    this.resumeTimeout = this.resume.timeout;
    this.dynamicNodeSwitching = this.node.dynamicSwitching;
    this.autoReconnectNodes = this.node.autoReconnect;
    this.wsReconnectTries = this.node.ws.reconnectTries;
    this.wsReconnectInterval = this.node.ws.reconnectInterval;
    this.restRetryCount = this.rest.retryCount;
    this.restTimeout = this.rest.timeout;
    this.regionCache = new Map();
    this.nodeHealthCache = new Map();
    this.cacheTimeout = 30_000;
    this.resolveCache = new Map(); // { identifier: { result, timestamp } }
    this.resolveCacheMaxSize = 200;
    this.resolveCacheTTL = 5 * 60 * 1000; // 5 minutes
    // Only statusSync (voice channel status)
    if (this.sync === true) {
      this.statusSync = new Status(this.client);
    } else if (typeof this.sync === 'object' && this.sync !== null) {
      this.statusSync = new Status(this.client, this.sync);
    } else {
      this.statusSync = null;
    }
    this.pluginInstances = [];
    this.version = pkgVersion; // Expose package version
  }

  // Helper to prune resolve cache
  pruneResolveCache() {
    const now = Date.now();
    for (const [key, value] of this.resolveCache.entries()) {
      if ((now - value.timestamp) > this.resolveCacheTTL) {
        this.resolveCache.delete(key);
      }
    }
    // Limit cache size
    while (this.resolveCache.size > this.resolveCacheMaxSize) {
      const firstKey = this.resolveCache.keys().next().value;
      this.resolveCache.delete(firstKey);
    }
  }

  /**
   * Initialize Teralink and connect to all nodes
   * @param {string} clientId - Discord client user ID
   * @returns {Teralink}
   */
  init(clientId) {
    if (this.initiated) return this;
    this.clientId = clientId;
    this.nodes.forEach((node) => this.createNode(node));
    this.initiated = true;
    this.emit("debug", `Teralink initialized, connecting to ${this.nodes.length} node(s)`);
    if (this.plugins) {
      this.emit("debug", `Loading ${this.plugins.length} Teralink plugin(s)`);
      this.plugins.forEach((plugin) => {
        if (plugin instanceof Plugin && typeof plugin.load === 'function') {
          plugin.load(this);
          this.pluginInstances.push(plugin);
        }
      });
    }
    // Status sync integration
    if (this.statusSync) {
      this.on("playerCreate", player => {
        player.on("trackStart", track => {
          this.statusSync.setVoiceStatus(player.voiceChannel, track.info);
        });
        player.on("trackEnd", () => {
          this.statusSync.clearVoiceStatus(player.voiceChannel);
        });
        player.on("destroy", () => {
          this.statusSync.clearVoiceStatus(player.voiceChannel);
        });
      });
    }
    // --- Begin: Dynamic Node Switching (Failover) ---
    this.on("nodeDisconnect", (node, event, reason) => {
      if (!this.dynamicNodeSwitching) return;
      for (const [guildId, player] of this.players) {
        if (player.node === node) {
          const playerData = player.toJSON();
          this.destroyPlayer(guildId);
          const newNode = this.leastUsedNodes.find(n => n !== node);
          if (!newNode) {
            this.emit("debug", `No healthy node available for failover for guild ${guildId}`);
            continue;
          }
          const newPlayer = require("./Player").Player.fromJSON(this, newNode, playerData);
          this.players.set(guildId, newPlayer);
          // Resume playback if there was a current track
          if (newPlayer.current) {
            newPlayer.play(newPlayer.current, { position: newPlayer.position });
          }
          this.emit("debug", `Migrated player for guild ${guildId} to node ${newNode.name}`);
          this.emit("playerCreate", newPlayer);
        }
      }
    });
    // --- End: Dynamic Node Switching (Failover) ---
  }

  createNode(options) {
    const node = new Node(this, options, this.options);
    this.nodeMap.set(options.name || options.host, node);
    node.connect();
    this.emit("nodeCreate", node);
    return node;
  }

  destroyNode(identifier) {
    const node = this.nodeMap.get(identifier);
    if (!node) return;
    node.disconnect();
    this.nodeMap.delete(identifier);
    this.nodeHealthCache.delete(identifier);
    this.emit("nodeDestroy", node);
  }

  get leastUsedNodes() {
    return [...this.nodeMap.values()]
      .filter((node) => node.connected)
      .sort((a, b) => {
        const aHealth = this.getNodeHealth(a);
        const bHealth = this.getNodeHealth(b);
        return aHealth.score - bHealth.score;
      });
  }

  // Add cache pruning for regionCache and nodeHealthCache
  pruneCaches() {
    const now = Date.now();
    // Prune regionCache
    for (const [key, value] of this.regionCache.entries()) {
      if ((now - value.timestamp) > this.cacheTimeout) {
        this.regionCache.delete(key);
      }
    }
    // Prune nodeHealthCache
    for (const [key, value] of this.nodeHealthCache.entries()) {
      if ((now - value.timestamp) > this.cacheTimeout) {
        this.nodeHealthCache.delete(key);
      }
    }
  }

  getNodeHealth(node) {
    this.pruneCaches();
    const now = Date.now();
    const cached = this.nodeHealthCache.get(node.name);
    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      return cached.health;
    }
    const health = node.getHealthStatus();
    const score = this.calculateNodeScore(health);
    this.nodeHealthCache.set(node.name, {
      health: { ...health, score },
      timestamp: now
    });
    return { ...health, score };
  }

  calculateNodeScore(health) {
    let score = 0;
    score += health.penalties * 10;
    score += health.cpuLoad * 100;
    score += health.memoryUsage * 0.5;
    score += health.ping * 0.1;
    score += health.players * 2;
    score += health.playingPlayers * 5;
    return score;
  }

  fetchRegion(region) {
    this.pruneCaches();
    const now = Date.now();
    const cacheKey = `region_${region}`;
    const cached = this.regionCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      return cached.nodes;
    }
    const nodesByRegion = [...this.nodeMap.values()]
      .filter((node) => node.connected && node.regions?.includes(region?.toLowerCase()))
      .sort((a, b) => {
        const aHealth = this.getNodeHealth(a);
        const bHealth = this.getNodeHealth(b);
        return aHealth.score - bHealth.score;
      });
    this.regionCache.set(cacheKey, {
      nodes: nodesByRegion,
      timestamp: now
    });
    return nodesByRegion;
  }

  getBestNodeForRegion(region) {
    const regionNodes = this.fetchRegion(region);
    return regionNodes.length > 0 ? regionNodes[0] : this.leastUsedNodes[0];
  }

  createConnection(options) {
    if (!this.initiated) throw new Error("You have to initialize Teralink in your ready event");
    const player = this.players.get(options.guildId);
    if (player) return player;
    if (this.leastUsedNodes.length === 0) throw new Error("No nodes are available");
    let node;
    if (options.region) {
      node = this.getBestNodeForRegion(options.region);
    } else {
      node = this.leastUsedNodes[0];
    }
    if (!node) throw new Error("No nodes are available");
    return this.createPlayer(node, options);
  }

  createPlayer(node, options) {
    const player = new Player(this, node, options);
    this.players.set(options.guildId, player);
    player.connect(options);
    this.emit('debug', `Created a player (${options.guildId}) on node ${node.name}`);
    this.emit("playerCreate", player);
    return player;
  }

  destroyPlayer(guildId) {
    const player = this.players.get(guildId);
    if (!player) return;
    player.destroy();
    this.players.delete(guildId);
    this.emit("playerDestroy", player);
  }

  removeConnection(guildId) {
    this.players.get(guildId)?.destroy();
    this.players.delete(guildId);
  }

  async loadPlayersState(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const playersData = JSON.parse(data);
      let loadedCount = 0;
      for (const [guildId, playerData] of Object.entries(playersData)) {
        try {
          const node = this.leastUsedNodes[0];
          if (!node) {
            this.emit("debug", `No available nodes to restore player for guild ${guildId}`);
            continue;
          }
          const player = Player.fromJSON(this, node, playerData);
          this.players.set(guildId, player);
          if (player.autoResumeState.enabled) {
            player.saveAutoResumeState();
          }
          loadedCount++;
          this.emit("playerCreate", player);
          this.emit("debug", `Restored player for guild ${guildId}`);
        } catch (error) {
          this.emit("debug", `Failed to restore player for guild ${guildId}: ${error.message}`);
        }
      }
      this.emit("debug", `Loaded ${loadedCount} player states from ${filePath}`);
      return loadedCount;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.emit("debug", `No player state file found at ${filePath}`);
        return 0;
      }
      this.emit("debug", `Failed to load player states: ${error.message}`);
      throw error;
    }
  }

  get(guildId) {
    return this.players.get(guildId);
  }

  /**
   * Resolve a query to tracks using the best available node.
   * @param {Object} params
   * @param {string} params.query - The search query or URL
   * @param {string} [params.source] - The search source (e.g., ytmsearch, spsearch)
   * @param {*} params.requester - The requester (user)
   * @param {string|Node} [params.node] - Node identifier or Node instance
   * @returns {Promise<{ loadType: string, tracks: any[], playlistInfo: any }>} - Lavalink response
   */
  async resolve({ query, source, requester, node }) {
    if (!this.initiated) throw new Error("You have to initialize Teralink in your ready event");
    if (node && (typeof node !== "string" && !(node instanceof Node))) throw new Error(`'node' property must either be a node identifier/name (string) or a Node instance, but received: ${typeof node}`);
    const querySource = source || this.defaultSearchPlatform;
    const requestNode = (node && typeof node === 'string' ? this.nodeMap.get(node) : node) || this.leastUsedNodes[0];
    if (!requestNode) throw new Error("No nodes are available.");
    const regex = /^https?:\/\//;
    const identifier = regex.test(query) ? query : `${querySource}:${query}`;

    // --- Begin: Caching logic ---
    this.pruneResolveCache();
    const cacheKey = identifier;
    const cached = this.resolveCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.resolveCacheTTL) {
      this.emit("debug", `Cache hit for resolve: ${identifier}`);
      return cached.result;
    }
    // --- End: Caching logic ---

    this.emit("debug", `Searching for ${query} on node \"${requestNode.name}\"`);
    let response = await requestNode.rest.makeRequest("GET", `/${requestNode.rest.version}/loadtracks?identifier=${encodeURIComponent(identifier)}`);
    // Debug: Log raw Lavalink response for Spotify URLs
    if (identifier.includes('spotify.com')) {
      this.emit('debug', `Raw Lavalink response for Spotify: ${JSON.stringify(response, null, 2)}`);
    }
    // Handle failed requests (like 500 errors)
    if (!response || response.loadType === "error") {
      this.emit("debug", `Search failed for \"${query}\" on node \"${requestNode.name}\": ${response?.data?.message || 'Unknown error'}`);
      // Try fallback search if it's a URL
      if (regex.test(query)) {
        this.emit("debug", `Attempting fallback search for \"${query}\"`);
        const fallbackIdentifier = `${querySource}:${query}`;
        response = await requestNode.rest.makeRequest("GET", `/${requestNode.rest.version}/loadtracks?identifier=${encodeURIComponent(fallbackIdentifier)}`);
      }
      if (!response || response.loadType === "error") {
        throw new Error(response?.data?.message || 'Failed to load tracks');
      }
    }
    // Try to resolve identifiers for Spotify/YouTube if no matches
    if (response.loadType === "empty" || response.loadType === "NO_MATCHES") {
      response = await requestNode.rest.makeRequest("GET", `/${requestNode.rest.version}/loadtracks?identifier=https://open.spotify.com/track/${query}`);
      if (response.loadType === "empty" || response.loadType === "NO_MATCHES") {
        response = await requestNode.rest.makeRequest("GET", `/${requestNode.rest.version}/loadtracks?identifier=https://www.youtube.com/watch?v=${query}`);
      }
    }
    let tracks = [];
    let playlistInfo = null;
    if (requestNode.rest.version === "v4") {
      if (response.loadType === "track") {
        tracks = response.data ? [new (require("./Track").Track)(response.data, requester, requestNode)] : [];
        this.emit("debug", `Search Success for \"${query}\" on node \"${requestNode.name}\", loadType: ${response.loadType}, Resulted track Title: ${tracks[0]?.info?.title}`);
      } else if (response.loadType === "playlist") {
        const trackData = response.data?.tracks || [];
        tracks = await Promise.all(trackData.map(track => Promise.resolve(new (require("./Track").Track)(track, requester, requestNode))));
        playlistInfo = response.data?.info || null;
        this.emit("debug", `Search Success for \"${query}\" on node \"${requestNode.name}\", loadType: ${response.loadType} tracks: ${tracks.length}`);
      } else {
        const trackData = response.loadType === "search" && response.data ? response.data : [];
        tracks = await Promise.all(trackData.map(track => Promise.resolve(new (require("./Track").Track)(track, requester, requestNode))));
        this.emit("debug", `Search ${response.loadType !== "error" ? "Success" : "Failed"} for \"${query}\" on node \"${requestNode.name}\", loadType: ${response.loadType} tracks: ${tracks.length}`);
      }
    } else {
      // v3 (legacy)
      const trackData = response?.tracks || [];
      tracks = await Promise.all(trackData.map(track => Promise.resolve(new (require("./Track").Track)(track, requester, requestNode))));
      this.emit("debug", `Search ${response.loadType !== "error" && response.loadType !== "LOAD_FAILED" ? "Success" : "Failed"} for \"${query}\" on node \"${requestNode.name}\", loadType: ${response.loadType} tracks: ${tracks.length}`);
    }
    const result = {
      loadType: response.loadType,
      tracks,
      playlistInfo
    };
    // --- Store in cache ---
    this.resolveCache.set(cacheKey, { result, timestamp: Date.now() });
    this.pruneResolveCache();
    // --- End cache store ---
    return result;
  }

  /**
   * Handle Discord voice state updates for a guild/player.
   * @param {Object} packet - Discord voice state/voice server update packet
   */
  updateVoiceState(packet) {
    if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(packet.t)) return;
    const player = this.players.get(packet.d.guild_id);
    if (!player) return;
    if (packet.t === "VOICE_SERVER_UPDATE") {
      player.connection.setServerUpdate(packet.d);
    } else if (packet.t === "VOICE_STATE_UPDATE") {
      if (packet.d.user_id !== this.clientId) return;
      player.connection.setStateUpdate(packet.d);
    }
  }

  async search(query, requester, source = this.defaultSearchPlatform) {
    return this.resolve({ query, source, requester });
  }

  getNodesHealth() {
    const health = {};
    for (const [name, node] of this.nodeMap) {
      health[name] = this.getNodeHealth(node);
    }
    return health;
  }

  getSystemHealth() {
    const nodesHealth = this.getNodesHealth();
    const connectedNodes = Object.values(nodesHealth).filter(h => h.connected);
    const totalPlayers = Object.values(nodesHealth).reduce((sum, h) => sum + h.players, 0);
    const totalPlayingPlayers = Object.values(nodesHealth).reduce((sum, h) => sum + h.playingPlayers, 0);
    return {
      totalNodes: Object.keys(nodesHealth).length,
      connectedNodes: connectedNodes.length,
      totalPlayers,
      totalPlayingPlayers,
      averagePing: connectedNodes.length > 0 ? 
        connectedNodes.reduce((sum, h) => sum + h.averagePing, 0) / connectedNodes.length : 0,
      nodesHealth
    };
  }

  clearCaches() {
    this.regionCache.clear();
    this.nodeHealthCache.clear();
    this.resolveCache.clear();
    this.emit("debug", "All caches cleared");
  }

  async savePlayersState(filePath) {
    try {
      const playersData = {};
      for (const [guildId, player] of this.players) {
        if (player.current || player.queue.length > 0) {
          playersData[guildId] = player.toJSON();
        }
      }
      await fs.writeFile(filePath, JSON.stringify(playersData, null, 2));
      this.emit("debug", `Saved ${Object.keys(playersData).length} player states to ${filePath}`);
      return playersData;
    } catch (error) {
      this.emit("debug", `Failed to save player states: ${error.message}`);
      throw error;
    }
  }

  async destroy() {
    // Remove all event listeners and clear caches
    this.removeAllListeners();
    for (const player of this.players.values()) {
      player.removeAllListeners && player.removeAllListeners();
      if (typeof player.destroy === 'function') player.destroy();
    }
    for (const node of this.nodeMap.values()) {
      node.removeAllListeners && node.removeAllListeners();
      if (typeof node.destroy === 'function') node.destroy();
    }
    this.players.clear();
    this.nodeMap.clear();
    this.regionCache.clear();
    this.nodeHealthCache.clear();
    this.resolveCache.clear();
    this.pluginInstances = [];
    this.statusSync = null;
    this.initiated = false;
    this.emit("destroy");
  }
}

module.exports = { Teralink }; 