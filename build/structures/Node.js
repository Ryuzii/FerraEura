const Websocket = require("ws");
const { Rest } = require("./Rest");
const { Track } = require("./Track");

class Node {
    /**
     * @param {import("./Tera").Teralink} tera 
     * @param {} node 
     */
    constructor(tera, node, options) {
        this.tera = tera;
        this.name = node.name || node.host;
        this.host = node.host || "localhost";
        this.port = node.port || 2333;
        this.password = node.password || "youshallnotpass";
        this.restVersion = options.restVersion;
        this.secure = node.secure || false;
        this.sessionId = node.sessionId || null;
        this.rest = new Rest(tera, this);
        // Improved URL construction with HTTP2 support
        this.wsUrl = this.constructWsUrl();
        this.restUrl = this.constructRestUrl();
        this.ws = null;
        this.regions = node.regions;
        /**
         * Lavalink Info fetched While/After connecting.
         * @type {import("..\").NodeInfo | null}
         */
        this.info = null;
        this.stats = {
            players: 0,
            playingPlayers: 0,
            uptime: 0,
            memory: {
                free: 0,
                used: 0,
                allocated: 0,
                reservable: 0,
            },
            cpu: {
                cores: 0,
                systemLoad: 0,
                lavalinkLoad: 0,
            },
            frameStats: {
                sent: 0,
                nulled: 0,
                deficit: 0,
            },
        };
        this.connected = false;
        // Improved autoResume configuration
        this.resumeKey = options.resumeKey || null;
        this.resumeTimeout = options.resumeTimeout || 60;
        this.autoResume = options.autoResume || false;
        this.autoResumePlayers = new Map(); // Track players for autoResume
        this.reconnectTimeout = options.reconnectTimeout || 5000;
        this.reconnectTries = options.reconnectTries || 3;
        this.reconnectAttempt = null;
        this.reconnectAttempted = 1;
        this.lastStats = Date.now();
        // Performance tracking
        this.connectionStartTime = null;
        this.lastPing = 0;
        this.pingHistory = [];
        this.maxPingHistory = 10;
    }

    constructWsUrl() {
        const protocol = this.secure ? "wss" : "ws";
        const version = this.restVersion === "v4" ? "/v4/websocket" : "";
        return `${protocol}://${this.host}:${this.port}${version}`;
    }

    constructRestUrl() {
        const protocol = this.secure ? "https" : "http";
        return `${protocol}://${this.host}:${this.port}`;
    }

    lyrics = {
        checkAvailable: async (eitherOne=true,...plugins) => {
            if (!this.sessionId) throw new Error(`Node (${this.name}) is not Ready/Connected.`)
            if (!plugins.length) plugins = ["lavalyrics-plugin", "java-lyrics-plugin", "lyrics"];
            const missingPlugins = [];
            plugins.forEach((plugin) => {
                const p = this.info.plugins.find((p) => p.name === plugin)
                if (!p) {
                    missingPlugins.push(plugin)
                    return false;
                }
                return true;
            });
            const AllPluginsMissing = missingPlugins.length === plugins.length;
            if (eitherOne && AllPluginsMissing) {
                throw new RangeError(`Node (${this.name}) is missing plugins: ${missingPlugins.join(", ")} (required for Lyrics)`)
            } else if (!eitherOne && missingPlugins.length) {
                throw new RangeError(`Node (${this.name}) is missing plugins: ${missingPlugins.join(", ")} (required for Lyrics)`)
            }
            return true
        },
        get: async (trackOrEncodedTrackStr, skipTrackSource=false) => {
            if (!(await this.lyrics.checkAvailable(false, "lavalyrics-plugin"))) return null;
            if(!(trackOrEncodedTrackStr instanceof Track) && typeof trackOrEncodedTrackStr !== "string") throw new TypeError(`Expected \`Track\` or \`string\` for \`trackOrEncodedTrackStr\` in "lyrics.get" but got \`${typeof trackOrEncodedTrackStr}\``)
            let encodedTrackStr = typeof trackOrEncodedTrackStr === "string" ? trackOrEncodedTrackStr : trackOrEncodedTrackStr.track;
            return await this.rest.makeRequest("GET",`/v4/lyrics?skipTrackSource=${skipTrackSource}&track=${encodedTrackStr}`);
        },
        getCurrentTrack: async (guildId, skipTrackSource=false, plugin) => {
            const DEFAULT_PLUGIN = "lavalyrics-plugin"
            if (!(await this.lyrics.checkAvailable())) return null;
            const nodePlugins = this.info?.plugins;
            let requestURL = `/v4/sessions/${this.sessionId}/players/${guildId}/track/lyrics?skipTrackSource=${skipTrackSource}&plugin=${plugin}`
            if(!plugin && (nodePlugins.find((p) => p.name === "java-lyrics-plugin") || nodePlugins.find((p) => p.name === "lyrics")) && !(nodePlugins.find((p) => p.name === DEFAULT_PLUGIN))) {
                requestURL = `/v4/sessions/${this.sessionId}/players/${guildId}/lyrics?skipTrackSource=${skipTrackSource}`
            } else if(plugin && ["java-lyrics-plugin", "lyrics"].includes(plugin)) {
                requestURL = `/v4/sessions/${this.sessionId}/players/${guildId}/lyrics?skipTrackSource=${skipTrackSource}`
            }
            return await this.rest.makeRequest("GET", `${requestURL}`)
        }
    }

    async fetchInfo(options = { restVersion: this.restVersion, includeHeaders: false }) {
        try {
            return await this.rest.makeRequest("GET", `/${options.restVersion || this.restVersion}/info`, null, options.includeHeaders);
        } catch (error) {
            this.tera.emit('debug', this.name, `Failed to fetch node info: ${error.message}`);
            throw error;
        }
    }

    async connect() {
        if (this.connected) return;
        this.connectionStartTime = Date.now();
        this.tera.emit('debug', this.name, `Connecting to node...`);
        const headers = {
            "Authorization": this.password,
            "User-Id": this.tera.clientId,
            "Client-Name": `Teralink/${this.tera.version}`,
        };
        if (this.restVersion === "v4") {
            if (this.sessionId) headers["Session-Id"] = this.sessionId;
        } else {
            if (this.resumeKey) headers["Resume-Key"] = this.resumeKey;
        }
        if (this.secure) {
            headers["Accept"] = "application/json";
            headers["Accept-Encoding"] = "gzip, deflate, br";
        }
        this.ws = new Websocket(this.wsUrl, { headers });
        this.ws.on("open", this.open.bind(this));
        this.ws.on("error", this.error.bind(this));
        this.ws.on("message", this.message.bind(this));
        this.ws.on("close", this.close.bind(this));
    }

    async open() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.connected = true;
        const connectionTime = Date.now() - this.connectionStartTime;
        this.tera.emit('debug', this.name, `Connection established in ${connectionTime}ms`);
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Node info fetch timeout')), 5000)
            );
            const infoPromise = this.fetchInfo();
            this.info = await Promise.race([infoPromise, timeoutPromise]);
            this.tera.emit('debug', this.name, `Node info fetched successfully`);
        } catch (error) {
            this.tera.emit('debug', this.name, `Failed to fetch node info: ${error.message}`);
            this.info = null;
        }
        if (!this.info && this.options?.bypassChecks?.nodeFetchInfo === false) {
            throw new Error(`Node (${this.name} - URL: ${this.restUrl}) Failed to fetch info on WS-OPEN`);
        }
        if (this.autoResume) {
            await this.performAutoResume();
        }
    }

    async performAutoResume() {
        try {
            const playersToResume = [];
            for (const player of this.tera.players.values()) {
                if (player.node === this && player.current) {
                    playersToResume.push(player);
                }
            }
            if (playersToResume.length === 0) {
                return;
            }
            const resumePromises = playersToResume.map(async (player) => {
                try {
                    if (player.track && player.track.encoded) {
                        await this.rest.updatePlayer({
                            guildId: player.guildId,
                            playerOptions: {
                                track: { encoded: player.track.encoded },
                                position: player.position || 0,
                                volume: player.volume || 100,
                                filters: player.filters || {},
                                paused: player.paused || false
                            }
                        });
                    }
                } catch (error) {
                    this.tera.emit("debug", this.name, `Failed to resume player ${player.guildId}: ${error.message}`);
                }
            });
            await Promise.all(resumePromises);
        } catch (error) {
            this.tera.emit("debug", this.name, `AutoResume failed: ${error.message}`);
        }
    }

    error(event) {
        if (!event) return;
        this.tera.emit("nodeError", this, event);
    }

    async message(msg) {
        if (Array.isArray(msg)) msg = Buffer.concat(msg);
        else if (msg instanceof ArrayBuffer) msg = Buffer.from(msg);
        const payload = JSON.parse(msg.toString());
        if (!payload.op) return;
        this.tera.emit("raw", "Node", payload);
        if (payload.op === "stats") {
            this.stats = { ...payload };
            this.lastStats = Date.now();
            if (payload.ping) {
                this.lastPing = payload.ping;
                this.pingHistory.push(payload.ping);
                if (this.pingHistory.length > this.maxPingHistory) {
                    this.pingHistory.shift();
                }
            }
        }
        if (payload.op === "ready") {
            if (this.sessionId !== payload.sessionId) {
                this.rest.setSessionId(payload.sessionId);
                this.sessionId = payload.sessionId;
            }
            this.tera.emit("nodeConnect", this);
            if (this.restVersion === "v4") {
                if (this.sessionId) {
                    try {
                        await this.rest.makeRequest(`PATCH`, `/${this.rest.version}/sessions/${this.sessionId}`, { 
                            resuming: true, 
                            timeout: this.resumeTimeout 
                        });
                    } catch (error) {
                        this.tera.emit("debug", this.name, `Failed to configure resuming: ${error.message}`);
                    }
                }
            } else {
                if (this.resumeKey) {
                    try {
                        await this.rest.makeRequest(`PATCH`, `/${this.rest.version}/sessions/${this.sessionId}`, { 
                            resumingKey: this.resumeKey, 
                            timeout: this.resumeTimeout 
                        });
                    } catch (error) {
                        this.tera.emit("debug", this.name, `Failed to configure resuming: ${error.message}`);
                    }
                }
            }
        }
        const player = this.tera.players.get(payload.guildId);
        if (payload.guildId && player) player.emit(payload.op, payload);
    }

    close(event, reason) {
        this.connected = false;
        this.tera.emit("nodeDisconnect", this, event, reason);
        if (this.reconnectAttempted <= this.reconnectTries) {
            this.tera.emit("debug", this.name, `Connection closed, attempting to reconnect... (${this.reconnectAttempted}/${this.reconnectTries})`);
            this.reconnect();
        } else {
            this.tera.emit("debug", this.name, `Connection closed, max reconnection attempts reached`);
        }
    }

    reconnect() {
        if (this.reconnectAttempt) clearTimeout(this.reconnectAttempt);
        this.reconnectAttempt = setTimeout(() => {
            this.reconnectAttempted++;
            this.connect();
        }, this.reconnectTimeout);
    }

    destroy(clean = false) {
        this.connected = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectAttempt) {
            clearTimeout(this.reconnectAttempt);
            this.reconnectAttempt = null;
        }
        this.autoResumePlayers.clear();
        if (this.rest) {
            this.rest.destroy();
        }
        this.tera.emit("nodeDestroy", this);
    }

    disconnect() {
        this.connected = false;
        if (this.ws) this.ws.close();
        if (this.reconnectAttempt) clearTimeout(this.reconnectAttempt);
    }

    get penalties() {
        let penalties = 0;
        if (this.stats) {
            penalties += this.stats.playingPlayers * 1;
            penalties += (this.stats.cpu.systemLoad / this.stats.cpu.cores) * 10;
            if (this.stats.frameStats && this.stats.frameStats.deficit) {
                penalties += Math.round(this.stats.frameStats.deficit * 2.5);
            }
            penalties += this.stats.players;
        }
        return penalties;
    }

    getHealthStatus() {
        const now = Date.now();
        const uptime = now - this.lastStats;
        return {
            connected: this.connected,
            uptime,
            ping: this.lastPing,
            averagePing: this.pingHistory.length > 0 ? 
                this.pingHistory.reduce((a, b) => a + b, 0) / this.pingHistory.length : 0,
            penalties: this.penalties,
            players: this.stats.players,
            playingPlayers: this.stats.playingPlayers,
            cpuLoad: this.stats.cpu ? this.stats.cpu.systemLoad / this.stats.cpu.cores : 0,
            memoryUsage: this.stats.memory ? 
                (this.stats.memory.used / this.stats.memory.allocated) * 100 : 0
        };
    }
}

module.exports = { Node }; 