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
    this.defaultSearchPlatform = options.defaultSearchPlatform || "ytmsearch";
    this.restVersion = SUPPORTED_VERSION;
    this.tracks = [];
    this.plugins = options.plugins || [];
    this.resumeKey = options.resumeKey || "teralink-resume";
    this.resumeTimeout = options.resumeTimeout || 60_000;
    this.dynamicNodeSwitching = options.dynamicNodeSwitching !== false;
    this.autoReconnectNodes = options.autoReconnectNodes !== false;
    this.autopauseOnEmpty = options.autopauseOnEmpty !== false;
    this.wsReconnectTries = options.wsReconnectTries || 5;
    this.wsReconnectInterval = options.wsReconnectInterval || 5000;
    this.restRetryCount = options.restRetryCount || 3;
    this.restTimeout = options.restTimeout || 5000;
    this.regionCache = new Map();
    this.nodeHealthCache = new Map();
    this.cacheTimeout = 30_000;
    this.lazyLoad = options.lazyLoad || false;
    this.lazyLoadTimeout = options.lazyLoadTimeout || 5000;
    // Only statusSync (voice channel status)
    if (options.sync === true) {
      this.statusSync = new Status(this.client);
    } else if (typeof options.sync === 'object' && options.sync !== null) {
      this.statusSync = new Status(this.client, options.sync);
    } else {
      this.statusSync = null;
    }
    this.pluginInstances = [];
    this.version = pkgVersion; // Expose package version
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

  getNodeHealth(node) {
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
    this.emit("debug", `Searching for ${query} on node \"${requestNode.name}\"`);
    let response = await requestNode.rest.makeRequest("GET", `/${requestNode.rest.version}/loadtracks?identifier=${encodeURIComponent(identifier)}`);
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
    return {
      loadType: response.loadType,
      tracks,
      playlistInfo
    };
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
    for (const player of this.players.values()) {
      player.destroy();
    }
    this.players.clear();
    for (const node of this.nodeMap.values()) {
      node.destroy();
    }
    this.nodeMap.clear();
    this.clearCaches();
    this.initiated = false;
    this.emit("destroy");
  }
}

module.exports = { Teralink }; 