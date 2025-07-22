<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=wave&color=7F5AF0,2CB67D&height=300&section=header&text=Teralink&fontSize=90&fontAlignY=35&animation=twinkling&fontColor=ffffff&desc=Next-Gen%20Lavalink%20Manager%20for%20Discord%20Bots&descSize=25&descAlignY=60" />
</p>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Montserrat&duration=3000&pause=1000&color=7F5AF0&center=true&vCenter=true&width=600&lines=Super+Performant+Lavalink+Manager+for+Discord+Bots;Optimized+for+Lavalink+v4+%26+Node.js;Industry-Leading+Performance;Extensible+and+Modern+API" />
</p>

<p align="center">
  <img src="https://img.shields.io/npm/dm/teralink?style=for-the-badge&label=Downloads&color=7F5AF0&labelColor=23272a" alt="NPM Downloads"/>
  <img src="https://img.shields.io/github/stars/Ryuzii/teralink?style=for-the-badge&label=Stars&color=2CB67D&labelColor=23272a" alt="GitHub Stars"/>
  <img src="https://img.shields.io/github/forks/Ryuzii/teralink?style=for-the-badge&label=Forks&color=FFD803&labelColor=23272a" alt="GitHub Forks"/>
  <img src="https://img.shields.io/npm/v/teralink?style=for-the-badge&label=Version&color=7F5AF0&labelColor=23272a" alt="NPM Version"/>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/Changelog-Important-blueviolet?style=for-the-badge&labelColor=23272a" alt="Changelog"/></a>
</p>

---

## 🚀 Teralink: Next-Generation Lavalink Manager

### 🎧 Modern, Fast, and Extensible Lavalink Client

Teralink is a next-generation, v4-only Lavalink manager for Discord bots, designed for performance, extensibility, and a beautiful developer experience. Enjoy seamless music streaming, advanced queueing, robust event handling, and real-time features—all in one open-source package.

---

## 🌟 Features

### 🔥 New in v0.2.0
- **🧠 Smart Search**: Automatic source detection from URLs and query enhancement for better results
- **🛡️ Enhanced Error Handling**: Intelligent retry logic with exponential backoff for network errors
- **📊 Performance Monitoring**: Real-time metrics tracking including cache hit rates and memory usage
- **🧹 Automatic Memory Management**: Intelligent cleanup and leak prevention with configurable thresholds
- **📋 Advanced Queue Analytics**: Comprehensive statistics, search functionality, and duplicate detection
- **⚡ Enhanced Caching**: 2.5x larger cache with longer TTL for improved performance

### 🎵 Core Features
- Super-performant node management and failover (automatic player migration if a node goes offline)
- Advanced player controls and queueing with real-time analytics
- Multi-source search (YouTube, Spotify, SoundCloud, Apple Music, and more)
- TypeScript support and comprehensive documentation
- Plugin system for extensibility
- Real-time voice channel status sync (statusSync)
- Region-aware node selection and health diagnostics
- Auto-resume, advanced queue, lyrics (including real-time LRC), and more
- **Clean, nested config structure for easier setup**
- **Intelligent caching for super-fast track/playlist resolution**
- **Automatic player migration (failover):** If a Lavalink node goes offline and dynamicSwitching is enabled, Teralink will automatically move all affected players to a healthy node and resume playback from the last position.

---

## 💡 Why Choose Teralink?
- Built for modern Discord bots (Lavalink v4+ only)
- No legacy code, fully open source
- Inspired by the best, but uniquely original
- Designed for both beginners and advanced devs
- Created and maintained by [Ryuzii](https://github.com/Ryuzii)

---

## 📦 Installation

```sh
npm install teralink
```

---

## 🚀 Quick Start

```js title="index.js"
const { Teralink } = require('teralink');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

const nodes = [
  { name: 'Lavalink', host: 'localhost', port: 2333, password: 'youshallnotpass', secure: false }
];

function send(packet) {
  const guildId = packet.d?.guild_id || packet.guild_id;
  if (!guildId) return;
  const guild = client.guilds.cache.get(guildId);
  if (guild && guild.shard) {
    guild.shard.send(packet);
  } else if (client.ws && typeof client.ws.send === 'function') {
    client.ws.send(packet);
  }
}

const tera = new Teralink(client, LAVALINK_NODES, {
  send,
  source: { default: 'ytmsearch' },
  rest: {
    version: 'v4',
    retryCount: 3,
    timeout: 5000
  },
  plugins: [],
  sync: { template: 'Now playing: {title} by {author}' },
  resume: {
    key: 'teralink-resume',
    timeout: 60000
  },
  node: {
    dynamicSwitching: true,
    autoReconnect: true,
    ws: {
      reconnectTries: 5,
      reconnectInterval: 5000
    }
  },
  autopauseOnEmpty: true,
  lazyLoad: {
    enabled: true,
    timeout: 5000
  }
});

client.once('ready', () => {
  tera.init(client.user.id);
  console.log(`Logged in as ${client.user.tag}`);
});

// See exampleBot.js for full command and event handling
```

---

## 🛠️ Advanced Usage

### 🖧 Node Management
```js
tera.createNode({ name: 'Backup', host: 'localhost', port: 2444, password: 'backup', secure: false });
tera.destroyNode('Backup');
console.log(tera.getNodesHealth());
console.log(tera.getBestNodeForRegion('us'));
```

### 🎚️ Player Controls
```js
player.pause();
player.play();
player.seek(60000); // Seek to 1 minute
player.setVolume(80);
player.filters.setBassboost(true);
player.setLoop('track');
player.queue.shuffle();
```

### 📚 Queue Controls
```js
player.queue.move(0, 3); // Move first track to position 3
player.queue.remove(2); // Remove track at index 2
console.log(player.queue.toArray());
```

### 🧠 Smart Search (New in v0.2.0)
```js
// Smart search with automatic source detection and query enhancement
const results = await tera.smartSearch('https://open.spotify.com/track/xyz', user);
const enhanced = await tera.smartSearch('lofi hip hop official music video', user, {
  limit: 5,
  smartSearch: true
});

// Batch search for multiple queries
const queries = ['song1', 'song2', 'song3'];
const batchResults = await tera.batchSearch(queries, user, { limit: 10 });

// Traditional search still available
const yt = await tera.search('ytsearch:lofi hip hop', user);
const sc = await tera.search('scsearch:chill beats', user);
```

### 📊 Performance Monitoring (New in v0.2.0)
```js
// Get comprehensive performance metrics
const metrics = tera.getPerformanceMetrics();
console.log('Cache Hit Rate:', metrics.cacheHitRate + '%');
console.log('Memory Usage:', metrics.memoryUsage.heapUsagePercentage + '%');

// Memory management
const memory = tera.getMemoryUsage();
tera.performMemoryCleanup(); // Manual cleanup
tera.resetPerformanceMetrics();
```

### 📋 Advanced Queue Analytics (New in v0.2.0)
```js
// Comprehensive queue statistics
const stats = player.queue.getStats();
console.log('Total tracks:', stats.totalTracks);
console.log('Estimated playtime:', stats.estimatedPlaytime);
console.log('Unique artists:', stats.uniqueArtists);

// Advanced search within queue
const searchResults = player.queue.searchAdvanced('lofi', {
  limit: 5,
  fuzzy: true
});

// Queue optimization
const removedCount = player.queue.removeDuplicates('uri');
await player.queue.shuffleAsync();
```

### 📢 Events
```js
tera.on('trackStart', (player, track) => { /* ... */ });
tera.on('queueEnd', player => { /* ... */ });
tera.on('playerError', (player, error) => { /* ... */ });
tera.on('debug', message => { console.log(message); });
```

---

## 🧩 Extending Teralink

You can provide your own Player/Queue classes for custom behavior:

```js
class MyPlayer extends Player {
  // Custom logic...
}

const tera = new Teralink(client, nodes, {
  send,
  customPlayerClass: MyPlayer
});
```

---

## 📝 TypeScript Support
- Full types for all classes, options, and events
- Enhanced TypeScript definitions for v0.2.0 features
- See `build/index.d.ts` for details and autocompletion

## 📖 Documentation
- **[Complete Documentation](docs/docs.html)** - Comprehensive guide with examples
- **[API Reference](docs/api.md)** - Detailed API documentation
- **[Examples](docs/examples.md)** - Code examples and use cases
- **[Migration Guide](docs/docs.html#migration)** - Upgrading from v0.1.x to v0.2.0

---

## 🤖 Example Bot
See [`test/exampleBot.js`](https://github.com/Ryuzii/Teralink/blob/main/test/exampleBot.js) for a real-world Discord.js bot using Teralink, including play, queue, skip, stop, nowplaying, and real-time lyrics commands, and demonstrating the new clean, nested config style.

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

## 🙏 Thanks & Acknowledgements

Thank you for choosing **Teralink**!

**Special thanks:**
- The Euralink project and contributors for inspiration
- The Discord music bot community
- Everyone who tests, reports bugs, or contributes ideas

---

<p align="center">
  <b>✨ Teralink is proudly created and led by <a href="https://github.com/Ryuzii">@Ryuzii</a> ✨</b><br/>
  <sub>All core development, vision, and leadership by <a href="https://github.com/Ryuzii">@Ryuzii</a>. If you use Teralink, please credit and support the original creator!</sub>
</p>

--- 