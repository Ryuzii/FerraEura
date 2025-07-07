import { EventEmitter } from "tseep";

/**
 * Nullable type helper
 * @template T
 */
export type Nullable<T> = T | null;

/**
 * Track information structure
 * @typedef {Object} TrackInfo
 * @property {string} identifier
 * @property {boolean} seekable
 * @property {string} author
 * @property {number} length
 * @property {boolean} stream
 * @property {string} sourceName
 * @property {string} title
 * @property {string} uri
 * @property {string|null} isrc
 * @property {string|null} thumbnail
 * @property {*} requester
 */
export interface TrackInfo {
    identifier: string;
    seekable: boolean;
    author: string;
    length: number;
    stream: boolean;
    sourceName: string;
    title: string;
    uri: string;
    isrc: string | null;
    thumbnail: string | null;
    requester: any;
}

/**
 * Node health structure
 * @typedef {Object} NodeHealth
 * @property {number} penalties
 * @property {number} cpuLoad
 * @property {number} memoryUsage
 * @property {number} ping
 * @property {number} players
 * @property {number} playingPlayers
 * @property {boolean} connected
 * @property {number} [averagePing]
 * @property {number} score
 */
export interface NodeHealth {
    penalties: number;
    cpuLoad: number;
    memoryUsage: number;
    ping: number;
    players: number;
    playingPlayers: number;
    connected: boolean;
    averagePing?: number;
    score: number;
}

/**
 * System health structure
 * @typedef {Object} SystemHealth
 * @property {number} totalNodes
 * @property {number} connectedNodes
 * @property {number} totalPlayers
 * @property {number} totalPlayingPlayers
 * @property {number} averagePing
 * @property {Record<string, NodeHealth>} nodesHealth
 */
export interface SystemHealth {
    totalNodes: number;
    connectedNodes: number;
    totalPlayers: number;
    totalPlayingPlayers: number;
    averagePing: number;
    nodesHealth: Record<string, NodeHealth>;
}

/**
 * Teralink event signatures
 * @typedef {Object} TeralinkEvents
 * @property {(node: Node) => void} nodeCreate
 * @property {(node: Node) => void} nodeDestroy
 * @property {(player: Player) => void} playerCreate
 * @property {(player: Player) => void} playerDestroy
 * @property {(message: string) => void} debug
 */
export interface TeralinkEvents {
    nodeCreate: (node: Node) => void;
    nodeDestroy: (node: Node) => void;
    playerCreate: (player: Player) => void;
    playerDestroy: (player: Player) => void;
    debug: (message: string) => void;
    // Add more as needed
}

/**
 * Player event signatures
 * @typedef {Object} PlayerEvents
 * @property {(track: Track) => void} trackStart
 * @property {(track: Track) => void} trackEnd
 * @property {(track: Track, error: Error) => void} trackError
 * @property {() => void} queueEnd
 * @property {() => void} destroy
 */
export interface PlayerEvents {
    trackStart: (track: Track) => void;
    trackEnd: (track: Track) => void;
    trackError: (track: Track, error: Error) => void;
    queueEnd: () => void;
    destroy: () => void;
    // Add more as needed
}

/**
 * Represents a Lavalink track.
 */
export declare class Track {
    /**
     * @param data - Track data from Lavalink
     * @param requester - The user who requested the track
     * @param node - The node this track is associated with
     */
    constructor(data: any, requester: any, node: Node);
    /** The base64 track string */
    public track: string;
    /** Track info metadata */
    public info: TrackInfo;
    /**
     * Resolve this track using the Teralink instance.
     * @param tera - The Teralink instance
     * @returns The resolved Track
     */
    public resolve(tera: Teralink): Promise<Track>;
}

/**
 * Options for the REST manager
 */
export interface RestOptions {
    secure: boolean;
    host: string;
    port: number;
    sessionId: string;
    password: string;
    restVersion: string;
}

/**
 * REST API manager for Lavalink
 */
export declare class Rest extends EventEmitter {
    /**
     * @param tera - The Teralink instance
     * @param options - REST options
     */
    constructor(tera: Teralink, options: RestOptions);
    public tera: Teralink;
    public url: string;
    public sessionId: RestOptions["sessionId"];
    public password: RestOptions["password"];
    public version: RestOptions["restVersion"];
    public calls: number;
    /** Set the session ID */
    public setSessionId(sessionId: string): void;
    /** Make a REST request */
    public makeRequest(method: string, endpoint: string, body?: any): Promise<any>;
    /** Get all players */
    public getPlayers(): Promise<any>;
    /** Update a player */
    public updatePlayer(options: { guildId: string; data: any }): Promise<void>;
    /** Destroy a player */
    public destroyPlayer(guildId: string): Promise<any>;
    /** Get tracks by identifier */
    public getTracks(identifier: string): Promise<any>;
    /** Decode a single track */
    public decodeTrack(track: string, node?: any): Promise<any>;
    /** Decode multiple tracks */
    public decodeTracks(tracks: any[]): Promise<any>;
    /** Get node stats */
    public getStats(): Promise<any>;
    /** Get node info */
    public getInfo(): Promise<any>;
    /** Get route planner status */
    public getRoutePlannerStatus(): Promise<any>;
    /** Get route planner address info */
    public getRoutePlannerAddress(address: string): Promise<any>;
    /** Parse a REST response */
    public parseResponse(req: any): Promise<any>;
}

/**
 * Options for creating a player
 */
export interface PlayerOptions {
    guildId: string;
    textChannel?: string;
    voiceChannel?: string;
    deaf?: boolean;
    mute?: boolean;
    defaultVolume?: number;
    loop?: LoopOption;
}

/**
 * Loop modes for a player
 */
export type LoopOption = "none" | "track" | "queue";

/**
 * Represents a music player
 */
export declare class Player extends EventEmitter {
    /**
     * @param tera - The Teralink instance
     * @param node - The node to use
     * @param options - Player options
     */
    constructor(tera: Teralink, node: Node, options: PlayerOptions);
    public tera: Teralink;
    public node: Node;
    public options: PlayerOptions;
    public guildId: string;
    public textChannel: string;
    public voiceChannel: string;
    public connection: Connection;
    public deaf: boolean;
    public mute: boolean;
    public volume: number;
    public loop: string;
    public filters: Filters;
    public data: Record<string, any>;
    public queue: Queue<Track>;
    public position: number;
    public current: Track;
    public previous: Track | null;
    public playing: boolean;
    public paused: boolean;
    public connected: boolean;
    public timestamp: number;
    public ping: number;
    public isAutoplay: boolean;
    /** Play the current track */
    public play(): Promise<Player>;
    /** Autoplay the next track */
    public autoplay(): Promise<Player>;
    /** Connect to a voice channel */
    public connect(options?: PlayerOptions): void;
    /** Stop playback */
    public stop(): Player;
    /** Pause or unpause playback */
    public pause(toggle?: boolean): Player;
    /** Seek to a position in the track */
    public seek(position: number): void;
    /** Set the player volume */
    public setVolume(volume: number): Player;
    /** Set the loop mode */
    public setLoop(mode: LoopOption): Player;
    /** Set the text channel */
    public setTextChannel(channel: string): Player;
    /** Set the voice channel */
    public setVoiceChannel(channel: string, options?: { mute?: boolean; deaf?: boolean }): Player;
    /** Disconnect from the voice channel */
    public disconnect(): Player;
    /** Destroy the player */
    public destroy(): void;
    /** Serialize the player to JSON */
    public toJSON(): any;
    /** Listen to player events */
    public on<K extends keyof PlayerEvents>(event: K, listener: PlayerEvents[K]): this;
    public once<K extends keyof PlayerEvents>(event: K, listener: PlayerEvents[K]): this;
    public off<K extends keyof PlayerEvents>(event: K, listener: PlayerEvents[K]): this;
    public emit<K extends keyof PlayerEvents>(event: K, ...args: Parameters<PlayerEvents[K]>): boolean;
}

/**
 * Represents a queue of tracks
 * @template T
 */
export declare class Queue<T = any> extends Array<T> {
    /** Shuffle the queue */
    shuffle(): this;
    /** Move an item in the queue */
    move(from: number, to: number): this;
    /** Remove an item from the queue */
    remove(index: number): T | null;
    /** Convert the queue to an array */
    toArray(): T[];
}

/**
 * Plugin base class
 */
export declare class Plugin {
    /**
     * @param name - Plugin name
     */
    constructor(name: string);
    /** Load the plugin */
    load(tera: Teralink): void;
    /** Unload the plugin */
    unload(tera: Teralink): void;
}

/**
 * Filter options for audio processing
 */
export interface FilterOptions {
    volume?: number;
    equalizer?: Array<{ band: number; gain: number }>;
    karaoke?: object | null;
    timescale?: object | null;
    tremolo?: object | null;
    vibrato?: object | null;
    rotation?: object | null;
    distortion?: object | null;
    channelMix?: object | null;
    lowPass?: object | null;
    bassboost?: number | null;
    slowmode?: number | null;
    nightcore?: boolean | null;
    vaporwave?: boolean | null;
    _8d?: boolean | null;
}

/**
 * Audio filter manager
 */
export declare class Filters {
    /**
     * @param player - The player instance
     * @param options - Filter options
     */
    constructor(player: Player, options: FilterOptions);
    public player: Player;
    public volume?: number;
    public equalizer?: Array<{ band: number; gain: number }>;
    public karaoke?: object | null;
    public timescale?: object | null;
    public tremolo?: object | null;
    public vibrato?: object | null;
    public rotation?: object | null;
    public distortion?: object | null;
    public channelMix?: object | null;
    public lowPass?: object | null;
    public bassboost?: number | null;
    public slowmode?: number | null;
    public nightcore?: boolean | null;
    public vaporwave?: boolean | null;
    public _8d?: boolean | null;
    /** Set the equalizer bands */
    public setEqualizer(band: Array<{ band: number; gain: number }>): this;
    /** Enable/disable karaoke filter */
    public setKaraoke(enabled: boolean, options?: object): this;
    /** Enable/disable timescale filter */
    public setTimescale(enabled: boolean, options?: object): this;
    /** Enable/disable tremolo filter */
    public setTremolo(enabled: boolean, options?: object): this;
    /** Enable/disable vibrato filter */
    public setVibrato(enabled: boolean, options?: object): this;
    /** Enable/disable rotation filter */
    public setRotation(enabled: boolean, options?: object): this;
    /** Enable/disable distortion filter */
    public setDistortion(enabled: boolean, options?: object): this;
    /** Enable/disable channel mix filter */
    public setChannelMix(enabled: boolean, options?: object): this;
    /** Enable/disable low pass filter */
    public setLowPass(enabled: boolean, options?: object): this;
    /** Enable/disable bassboost filter */
    public setBassboost(enabled: boolean, options?: { value: number }): this;
    /** Enable/disable slowmode filter */
    public setSlowmode(enabled: boolean, options?: { rate: number }): this;
    /** Enable/disable nightcore filter */
    public setNightcore(enabled: boolean, options?: { rate: number }): this;
    /** Enable/disable vaporwave filter */
    public setVaporwave(enabled: boolean, options?: { pitch: number }): this;
    /** Enable/disable 8D filter */
    public set8D(enabled: boolean, options?: { rotationHz: number }): this;
    /** Clear all filters */
    public clearFilters(): this;
    /** Update filters on the player */
    public updateFilters(): this;
}

/**
 * Represents a voice connection
 */
export declare class Connection {
    /**
     * @param player - The player instance
     */
    constructor(player: Player);
    public player: Player;
    public sessionId: string;
    public voice: {
        sessionId: string;
        event: any;
        endpoint: string;
    };
    public region: string;
    public self_deaf: boolean;
    public self_mute: boolean;
    public voiceChannel: string;
    /** Set server update data */
    public setServerUpdate(data: { endpoint: string; token: string }): void;
    /** Set state update data */
    public setStateUpdate(data: { session_id: string; channel_id: string; self_deaf: boolean; self_mute: boolean }): void;
}

/**
 * Options for creating a Teralink instance
 */
export interface TeralinkOptions {
    /** Function to send payloads to Discord */
    send: Function;
    /** Default search platform */
    defaultSearchPlatform?: string;
    /** Lavalink REST API version */
    restVersion?: string;
    /** Array of plugin instances */
    plugins?: Array<Plugin>;
    /** Enable voice status sync or pass options */
    sync?: boolean | object;
    /** Enable activity status or pass options */
    setActivityStatus?: boolean | object;
    /** Session resume key */
    resumeKey?: string;
    /** Resume timeout in ms */
    resumeTimeout?: number;
    /** Enable dynamic node switching */
    dynamicNodeSwitching?: boolean;
    /** Auto-reconnect nodes */
    autoReconnectNodes?: boolean;
    /** Auto-pause when voice channel is empty */
    autopauseOnEmpty?: boolean;
    /** WebSocket reconnect attempts */
    wsReconnectTries?: number;
    /** WebSocket reconnect interval (ms) */
    wsReconnectInterval?: number;
    /** REST request retry count */
    restRetryCount?: number;
    /** REST request timeout (ms) */
    restTimeout?: number;
    /** Enable lazy loading */
    lazyLoad?: boolean;
    /** Lazy load timeout (ms) */
    lazyLoadTimeout?: number;
    // ...other options as needed
}

/**
 * Teralink - Next Generation Lavalink v4+ Super Performant Wrapper
 * @class
 * @extends EventEmitter
 * @param {Client} client - Your Discord.js client
 * @param {Array<any>} nodes - Lavalink node configs
 * @param {TeralinkOptions} options - Teralink options
 * @property {string} version - The package version of Teralink
 */
export declare class Teralink extends EventEmitter {
    /**
     * @param client - Your Discord.js client
     * @param nodes - Lavalink node configs
     * @param options - Teralink options
     */
    constructor(client: any, nodes: any[], options: TeralinkOptions);
    public client: any;
    public nodes: any[];
    public nodeMap: Map<string, Node>;
    public players: Map<string, Player>;
    public options: TeralinkOptions;
    /** The package version of Teralink */
    public version: string;
    /** Status sync instance */
    public statusSync?: any;
    /** Activity status options */
    public setActivityStatus?: any;
    /**
     * Initialize Teralink and connect to all nodes
     * @param clientId - Discord client user ID
     * @returns {Teralink}
     */
    public init(clientId: string): this;
    /**
     * Create a new node
     * @param options - Node options
     * @returns {Node}
     */
    public createNode(options: any): Node;
    /**
     * Destroy a node
     * @param identifier - Node name or host
     */
    public destroyNode(identifier: string): void;
    /**
     * Get a player by guild ID
     * @param guildId - Guild ID
     * @returns {Player | undefined}
     */
    public get(guildId: string): Player | undefined;
    /**
     * Create a connection/player
     * @param options - Player options
     * @returns {Player}
     */
    public createConnection(options: PlayerOptions & { region?: string }): Player;
    /**
     * Destroy a player
     * @param guildId - Guild ID
     */
    public destroyPlayer(guildId: string): void;
    /**
     * Remove a connection/player
     * @param guildId - Guild ID
     */
    public removeConnection(guildId: string): void;
    /**
     * Search for tracks
     * @param query - Search query
     * @param requester - Requester
     * @param source - Search source
     * @returns {Promise<any>}
     */
    public search(query: string, requester: any, source?: string): Promise<any>;
    /**
     * Save player states to a file
     * @param filePath - File path
     * @returns {Promise<any>}
     */
    public savePlayersState(filePath: string): Promise<any>;
    /**
     * Load player states from a file
     * @param filePath - File path
     * @returns {Promise<number>}
     */
    public loadPlayersState(filePath: string): Promise<number>;
    /**
     * Get health info for all nodes
     * @returns {Record<string, NodeHealth>}
     */
    public getNodesHealth(): Record<string, NodeHealth>;
    /**
     * Get overall system health
     * @returns {SystemHealth}
     */
    public getSystemHealth(): SystemHealth;
    /** Clear all caches */
    public clearCaches(): void;
    /** Destroy all resources */
    public destroy(): Promise<void>;
    /** Listen to Teralink events */
    public on<K extends keyof TeralinkEvents>(event: K, listener: TeralinkEvents[K]): this;
    public once<K extends keyof TeralinkEvents>(event: K, listener: TeralinkEvents[K]): this;
    public off<K extends keyof TeralinkEvents>(event: K, listener: TeralinkEvents[K]): this;
    public emit<K extends keyof TeralinkEvents>(event: K, ...args: Parameters<TeralinkEvents[K]>): boolean;
}

/**
 * Represents a Lavalink node
 */
export declare class Node {
    /**
     * @param tera - The Teralink instance
     * @param node - Node config
     * @param options - Node options
     */
    constructor(tera: Teralink, node: any, options: any);
    public tera: Teralink;
    public name: string;
    public host: string;
    public port: number;
    public password: string;
    public secure: boolean;
    public restVersion: string;
    public rest: Rest;
    public wsUrl: string;
    public restUrl: string;
    public resumeKey?: string;
    public sessionId?: string;
    public regions?: string[] | null;
    public resumeTimeout?: number;
    public autoResume?: boolean;
    public reconnectTimeout?: number;
    public reconnectTries?: number;
    public connected: boolean;
    /** Get node health status */
    public getHealthStatus(): NodeHealth;
    /** Fetch node info */
    public fetchInfo(): Promise<any>;
    /** Connect to Lavalink */
    public connect(): void;
    /** Disconnect from Lavalink */
    public disconnect(): void;
    /** Destroy the node */
    public destroy(): void;
    // ...other properties and methods
}

export { Teralink, Node, Player, Track, Queue, Filters, Connection, Rest, Plugin, TeralinkEvents, PlayerEvents, TrackInfo, NodeHealth, SystemHealth, TeralinkOptions, PlayerOptions, FilterOptions, RestOptions, LoopOption, Nullable }; 