<!-- Banner/Logo Placeholder -->
<p align="center">
  <svg width="100%" height="220" viewBox="0 0 1200 220" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="220" fill="#0a6cf1"/>
    <path d="M0 150 Q350 210 600 150 T1200 150 V220 H0Z" fill="#181A20"/>
    <text x="600" y="100" text-anchor="middle" font-size="68" font-family="Arial, Helvetica, sans-serif" fill="white" font-weight="bold" opacity="0.97">FerraEura</text>
    <text x="600" y="150" text-anchor="middle" font-size="28" font-family="Arial, Helvetica, sans-serif" fill="white" opacity="0.88">Next-Gen Lavalink Client for Discord Bots</text>
  </svg>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NOW%20PLAYING-FERRAEURA-0a6cf1?style=for-the-badge&labelColor=23272a&color=0a6cf1" alt="Now Playing Badge"/>
  <img src="https://img.shields.io/badge/open%20source-yes-43b581?style=for-the-badge&labelColor=23272a&color=43b581" alt="Open Source Badge"/>
  <img src="https://img.shields.io/badge/license-MIT-23272a?style=for-the-badge&labelColor=23272a&color=7289da" alt="MIT License Badge"/>
</p>

---

## 🚀 FerraEura: Unleash Your Discord Music Experience

### 🎧 Modern, Fast, and Flexible Lavalink Client

FerraEura is a next-generation Lavalink wrapper for Discord bots, designed for performance, extensibility, and a beautiful developer experience. Enjoy seamless music streaming, advanced queueing, and robust event handling—all in one open-source package.

---

## 🌟 Features
- Blazing fast node management and failover
- Advanced player controls and queueing
- Multi-source search (YouTube, Spotify, SoundCloud, and more)
- TypeScript support and full documentation
- Customizable, event-driven, and easy to extend

---

## 💡 Why Choose FerraEura?
- Built for modern Discord bots
- No vendor lock-in, fully open source
- Inspired by the best, but uniquely original
- Designed for both beginners and advanced devs

---

## 📦 Installation

```sh
npm install ferraeura
```

> **Note:** `euralink` is a dependency and will be installed automatically with FerraEura.

---

## 🚀 Quick Start

```js title="index.js"
const { FerraEura } = require('ferra-eura');

const client = new FerraEura({
  nodes: [
    { name: 'Lavalink', url: 'localhost:2333', auth: 'youshallpass', secure: false }
  ],
  spotify: [
    { ClientID: 'your_spotify_client_id', ClientSecret: 'your_spotify_client_secret' }
  ],
  defaultSearchEngine: 'FerraEuraSpotify'
});

client.on('nodeConnect', node => console.log(`Node connected: ${node.name}`));
client.on('trackStart', (player, track) => console.log(`Track started: ${track.info.title}`));

// Create a player
const player = client.createPlayer({
  guildId: '123',
  voiceId: '456',
  textId: '789',
  volume: 100,
  deaf: true
});

// Search and play
(async () => {
  const result = await client.search('Never Gonna Give You Up');
  if (result.tracks && result.tracks.length) {
    player.add(result.tracks[0]);
    await player.play();
  }
})();
```

---

## 🛠️ Advanced Usage

### 🖧 Node Management
```js
client.addNode({ name: 'Backup', url: 'localhost:2444', auth: 'backup', secure: false });
client.removeNode('Backup');
console.log(client.getNodeStats());
client.reconnectNodes();
console.log(client.getBestNode());
```

### 🎚️ Player Controls
```js
player.pause();
player.resume();
player.seek(60000); // Seek to 1 minute
player.setVolume(80);
player.setFilters({ bassboost: true });
player.setLoopTrack(true);
player.setLoopQueue(true);
player.shuffle();
```

### 📚 Queue Controls
```js
player.queue.addFirst(track);
player.queue.remove(2); // Remove track at index 2
player.queue.move(0, 3); // Move first track to position 3
const exported = player.queue.export();
player.queue.import(exported);
console.log(player.queue.getHistory());
```

### 🔍 Search Abstraction
```js
// Auto-detects source (YouTube, SoundCloud, Spotify)
const yt = await client.search('ytsearch:lofi hip hop');
const sc = await client.search('scsearch:chill beats');
const sp = await client.search('https://open.spotify.com/track/xyz');
// You can also force Spotify search:
const spotify = await client.search('Never Gonna Give You Up', { engine: 'FerraEuraSpotify' });
```

### 📢 Events
```js
client.on('trackEnd', (player, track) => { /* ... */ });
client.on('queueEnd', player => { /* ... */ });
client.on('playerUpdate', (player, data) => { /* ... */ });
client.on('searchError', (err, ctx) => { console.error('Search failed:', ctx.query, err); });
```

---

## 🧩 Extending FerraEura

You can provide your own Player/Queue classes for custom behavior:

```js
class MyPlayer extends Player {
  // Custom logic...
}

const client = new FerraEura({
  nodes: [...],
  customPlayerClass: MyPlayer
});
```

---

## 📝 TypeScript Support
- Full types for all classes, options, and events.
- See `types/index.d.ts` for details and autocompletion.

---

## 🤖 Example Bot
See [`example-bot.js`](./example-bot.js) for a real-world Discord.js bot using FerraEura, including a play command, event handling, and Spotify support.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
- Fork the repo and submit a pull request
- Open an issue for bugs or suggestions

---

## 💬 Support

Need help? Join our [Discord server](https://discord.gg/your-invite) or open an issue!

---

## 📄 License

MIT 

---

## 🧪 Example: Using Euralink Directly (V2 Features)

> This is an advanced example for users who want to use Euralink directly, including V2 features like player state persistence, custom activity, and more. Most users should use the FerraEura wrapper for simplicity and best practices.

```js
const { 
    Client,
    GatewayDispatchEvents,
    GatewayIntentBits,
    Partials
} = require('discord.js')
const { Euralink } = require('euralink')

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Configure your Lavalink nodes
const nodes = [
    {
        name: 'Main Node',
        host: 'localhost',
        password: 'youshallnotpass',
        port: 2333,
        secure: false,
        regions: ['us_central', 'us_east']
    }
]

// Initialize Euralink with V2 features
const eura = new Euralink(client, nodes, {
    send: (data) => {
        const guild = client.guilds.cache.get(data.d.guild_id);
        if (guild) guild.shard.send(data);
    },
    defaultSearchPlatform: 'ytmsearch',
    restVersion: 'v4',
    
    // V2 Features
    euraSync: {
        template: '🎵 {title} by {author}'
    },
    setActivityStatus: {
        template: '🎵 {title} by {author}'
    },
    autoResume: true
});

client.on('ready', async () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
    eura.init(client.user.id);
    
    // Load player states on startup
    try {
        await eura.loadPlayersState('./EuraPlayers.json');
        console.log('[Euralink V2] Player states loaded successfully');
    } catch (error) {
        console.log('[Euralink V2] No previous player states found');
    }
})

// Save player states on shutdown
process.on('SIGINT', async () => {
    console.log('[Euralink V2] Saving player states...');
    await eura.savePlayersState('./EuraPlayers.json');
  process.exit(0);
});

// Music command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith('!play ')) return;

    const query = message.content.slice('!play '.length).trim();
    if (!query) return message.reply('Please provide a search query or URL!');

    const member = message.member;
    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) {
        return message.reply('You must be in a voice channel!');
    }

    const player = eura.createConnection({
        guildId: message.guildId,
        voiceChannel: voiceChannel.id,
        textChannel: message.channelId
    })

    const result = await eura.resolve({ 
        query, 
        requester: message.author 
    });

    const { loadType, tracks, playlistInfo } = result;

    if (loadType === 'playlist') {
        player.queue.addPlaylist(tracks, playlistInfo);
        message.channel.send(`📀 Playlist: **${playlistInfo.name}** with **${tracks.length}** tracks`);
        if (!player.playing && !player.paused) return player.play();
    } else if (loadType === "search" || loadType === "track") {
        const track = tracks.shift();
        track.info.requester = message.author;
        player.queue.add(track);
        message.channel.send(`🎵 Added: **${track.info.title}**`);
        if (!player.playing && !player.paused) return player.play();
    } else {
        return message.channel.send("❌ No results found.");
    }
});

// Essential: Forward Discord voice events to Euralink
client.on('raw', (d) => {
    if ([
            GatewayDispatchEvents.VoiceStateUpdate,
            GatewayDispatchEvents.VoiceServerUpdate,
    ].includes(d.t)) {
    eura.updateVoiceState(d);
    }
});

client.login('YOUR_BOT_TOKEN')
``` 

---

## 🙏 Thanks & Acknowledgements

Thank you for choosing **FerraEura**!

**Special thanks:**
- The Euralink project and contributors 
- The Discord music bot community
- Everyone who tests, reports bugs, or contributes ideas

--- 
