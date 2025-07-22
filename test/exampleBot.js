const { Client, GatewayIntentBits, GatewayDispatchEvents } = require('discord.js');
const { Teralink } = require('../build');

/**
 * Teralink v0.2.0 Example Bot
 * 
 * This example demonstrates all the new features added in v0.2.0:
 * 
 * 🧠 Smart Search Features:
 * - smartSearch() with automatic source detection
 * - batchSearch() for multiple queries
 * - URL pattern recognition for Spotify, YouTube, etc.
 * 
 * 📊 Performance Monitoring:
 * - getPerformanceMetrics() for cache hit rates and memory usage
 * - getMemoryUsage() for detailed memory reporting
 * - Automatic memory management with cleanup
 * 
 * 📋 Advanced Queue Management:
 * - getStats() for comprehensive queue analytics
 * - searchAdvanced() with fuzzy matching
 * - removeDuplicates() for queue optimization
 * - Enhanced queue filtering and statistics
 * 
 * 🛡️ Enhanced Error Handling:
 * - Intelligent retry logic with exponential backoff
 * - Better network error recovery
 * - Node health monitoring with getHealthStatus()
 * 
 * Commands added:
 * !help - Show all commands
 * !stats - Queue statistics  
 * !performance - Performance metrics
 * !search <term> - Search within queue
 * !cleanup - Remove duplicates
 * !batch <song1, song2> - Batch search
 * !memory - Manual memory cleanup
 * !health - Node health status
 */

// Replace with your bot token and Lavalink node config
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'TOKEN';
const LAVALINK_NODES = [
  {
    name: 'main',
    host: 'lavalink.devxcode.in',
    port: 443,
    password: 'DevamOP',
    secure: true,
    regions: ['us', 'eu', 'asia']
  }
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

// Teralink send function for Discord voice updates
function send(packet) {
  // Defensive: support both {d: {guild_id}} and {guild_id}
  const guildId = packet.d?.guild_id || packet.guild_id;
  if (!guildId) return;
  const guild = client.guilds.cache.get(guildId);
  if (guild && guild.shard) {
    guild.shard.send(packet);
  } else if (client.ws && typeof client.ws.send === 'function') {
    client.ws.send(packet);
  }
}

// Expanded Teralink options for demonstration
const tera = new Teralink(client, LAVALINK_NODES, {
  send,
  source: { default: 'spsearch' },
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
  console.log(`Logged in as ${client.user.tag}`);
  tera.init(client.user.id);
});

client.on('messageCreate', async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  const prefix = '!';
  if (!msg.content.startsWith(prefix)) return;
  const [cmd, ...args] = msg.content.slice(prefix.length).trim().split(/ +/);
  const query = args.join(' ');

  // Join the user's voice channel helper
  const member = msg.guild.members.cache.get(msg.author.id);
  const voiceChannel = member?.voice?.channel;

  // Get or create player helper
  let player = tera.get(msg.guild.id);

  if (cmd === 'play') {
    if (!query) return msg.reply('Please provide a search query or URL.');
    if (!voiceChannel) return msg.reply('You must be in a voice channel!');
    if (!player) {
      player = tera.createConnection({
        guildId: msg.guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: msg.channel.id,
        deaf: true
      });
    } else {
      player.setTextChannel(msg.channel.id);
      player.setVoiceChannel(voiceChannel.id);
    }
    try {
      // Use smart search for better results (v0.2.0 feature)
      const result = await tera.smartSearch(query, msg.author, {
        limit: 5,
        smartSearch: true
      });
      const { loadType, tracks, playlistInfo } = result;
      if (loadType === 'playlist') {
        if (typeof player.queue.addPlaylist === 'function') {
          player.queue.addPlaylist(tracks, playlistInfo);
        } else {
          player.queue.push(...tracks);
        }
        msg.channel.send(`📀 Playlist: **${playlistInfo?.name || 'Unknown'}** with **${tracks.length}** tracks`);
        if (!player.playing && !player.paused) return player.play();
      } else if (loadType === "search" || loadType === "track") {
        const track = tracks.shift();
        track.info.requester = msg.author;
        if (typeof player.queue.add === 'function') {
          player.queue.add(track);
        } else {
          player.queue.push(track);
        }
        msg.channel.send(`🎵 Added: **${track.info.title}**`);
        if (!player.playing && !player.paused) return player.play();
      } else {
        return msg.channel.send("❌ No results found.");
      }
    } catch (err) {
      console.error(err);
      msg.reply('Error searching or playing track.');
    }
  }

  if (cmd === 'stop') {
    if (!player) return msg.reply('No player for this guild.');
    player.destroy();
    msg.channel.send('⏹️ Stopped and left the voice channel.');
  }

  if (cmd === 'skip') {
    if (!player) return msg.reply('No player for this guild.');
    player.stop();
    msg.channel.send('⏭️ Skipped the current track.');
  }

  if (cmd === 'queue') {
    if (!player || !player.queue.length) return msg.reply('The queue is empty.');
    const queueList = player.queue
      .slice(0, 10)
      .map((t, i) => `${i + 1}. **${t.info.title}** by **${t.info.author}**`)
      .join('\n');
    msg.channel.send(`🎶 **Queue:**\n${queueList}${player.queue.length > 10 ? `\n...and ${player.queue.length - 10} more` : ''}`);
  }

  // NEW v0.2.0 Commands

  if (cmd === 'stats') {
    if (!player) return msg.reply('No player for this guild.');
    // Get comprehensive queue statistics (v0.2.0 feature)
    const stats = player.queue.getStats();
    const embed = {
      title: '📊 Queue Statistics',
      fields: [
        { name: 'Total Tracks', value: stats.totalTracks.toString(), inline: true },
        { name: 'Estimated Playtime', value: stats.estimatedPlaytime, inline: true },
        { name: 'Unique Artists', value: stats.uniqueArtists.toString(), inline: true },
        { name: 'Unique Requesters', value: stats.uniqueRequesters.toString(), inline: true },
        { name: 'Average Duration', value: stats.averageDuration, inline: true },
        { name: 'Sources', value: Object.entries(stats.sources).map(([k, v]) => `${k}: ${v}`).join('\n') || 'None', inline: false }
      ],
      color: 0x7F5AF0
    };
    msg.channel.send({ embeds: [embed] });
  }

  if (cmd === 'performance') {
    // Get performance metrics (v0.2.0 feature)
    const metrics = tera.getPerformanceMetrics();
    const memory = tera.getMemoryUsage();
    const embed = {
      title: '📈 Performance Metrics',
      fields: [
        { name: 'Cache Hit Rate', value: `${metrics.cacheHitRate}%`, inline: true },
        { name: 'Memory Usage', value: `${metrics.memoryUsage.heapUsagePercentage}%`, inline: true },
        { name: 'Searches/min', value: metrics.averageSearchesPerMinute.toString(), inline: true },
        { name: 'Active Connections', value: metrics.activeConnections.toString(), inline: true },
        { name: 'Heap Used', value: `${memory.heapUsed}MB`, inline: true },
        { name: 'Heap Total', value: `${memory.heapTotal}MB`, inline: true }
      ],
      color: 0x2CB67D
    };
    msg.channel.send({ embeds: [embed] });
  }

  if (cmd === 'search') {
    if (!query) return msg.reply('Please provide a search term.');
    if (!player || !player.queue.length) return msg.reply('The queue is empty.');
    // Advanced queue search (v0.2.0 feature)
    const searchResults = player.queue.searchAdvanced(query, {
      limit: 5,
      fuzzy: true
    });
    if (searchResults.length === 0) {
      return msg.channel.send('❌ No tracks found in queue matching that search.');
    }
    const resultList = searchResults
      .map((result, i) => `${i + 1}. **${result.track.info.title}** (Score: ${result.score.toFixed(2)})`)
      .join('\n');
    msg.channel.send(`🔍 **Search Results in Queue:**\n${resultList}`);
  }

  if (cmd === 'cleanup') {
    if (!player) return msg.reply('No player for this guild.');
    // Remove duplicates from queue (v0.2.0 feature)
    const removedCount = player.queue.removeDuplicates('uri');
    if (removedCount > 0) {
      msg.channel.send(`🧹 Removed ${removedCount} duplicate tracks from the queue.`);
    } else {
      msg.channel.send('✨ No duplicates found in the queue.');
    }
  }

  if (cmd === 'batch') {
    if (!args.length) return msg.reply('Please provide multiple search terms separated by commas.');
    if (!voiceChannel) return msg.reply('You must be in a voice channel!');
    if (!player) {
      player = tera.createConnection({
        guildId: msg.guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: msg.channel.id,
        deaf: true
      });
    }
    try {
      // Batch search multiple queries (v0.2.0 feature)
      const queries = args.join(' ').split(',').map(q => q.trim());
      const batchResults = await tera.batchSearch(queries, msg.author, { limit: 1 });
      let addedCount = 0;
      
      for (const result of batchResults) {
        const { tracks } = result;
        if (tracks.length > 0) {
          const track = tracks[0];
          track.info.requester = msg.author;
          player.queue.add(track);
          addedCount++;
        }
      }
      
      msg.channel.send(`🎵 Added ${addedCount} tracks from batch search.`);
      if (!player.playing && !player.paused) player.play();
    } catch (err) {
      console.error(err);
      msg.reply('Error performing batch search.');
    }
  }

  if (cmd === 'memory') {
    // Manual memory cleanup (v0.2.0 feature)
    tera.performMemoryCleanup();
    msg.channel.send('🧹 Manual memory cleanup performed.');
  }

  if (cmd === 'health') {
    // Node health monitoring (v0.2.0 feature)
    const nodes = tera.nodes.values();
    const healthInfo = Array.from(nodes).map(node => {
      const health = node.getHealthStatus();
      return `**${node.name}**: ${node.isHealthy() ? '✅ Healthy' : '❌ Unhealthy'} (${health.averagePing}ms)`;
    }).join('\n');
    msg.channel.send(`🏥 **Node Health:**\n${healthInfo}`);
  }

  if (cmd === 'help') {
    const embed = {
      title: '🎵 Teralink v0.2.0 Bot Commands',
      description: 'Here are all available commands:',
      fields: [
        {
          name: '🎶 Basic Playback',
          value: '`!play <song>` - Play a song (uses smart search)\n`!stop` - Stop and disconnect\n`!skip` - Skip current track\n`!queue` - Show current queue\n`!nowplaying` or `!np` - Current track',
          inline: false
        },
        {
          name: '🆕 v0.2.0 Features',
          value: '`!stats` - Queue statistics\n`!performance` - Performance metrics\n`!search <term>` - Search within queue\n`!cleanup` - Remove duplicates\n`!batch <song1, song2, song3>` - Batch search\n`!memory` - Manual memory cleanup\n`!health` - Node health status',
          inline: false
        },
        {
          name: '🎤 Advanced',
          value: '`!lyrics` - Get lyrics for current track\n`!lyrics <title> - <artist>` - Custom lyrics search',
          inline: false
        }
      ],
      color: 0x7F5AF0,
      footer: { text: 'Teralink v0.2.0 - Next-generation Lavalink client' }
    };
    msg.channel.send({ embeds: [embed] });
  }

  if (cmd === 'nowplaying' || cmd === 'np') {
    if (!player || !player.current) return msg.reply('Nothing is playing.');
    msg.channel.send(`▶️ Now playing: **${player.current.info.title}** by **${player.current.info.author}**`);
  }

  if (cmd === 'lyrics') {
    if (!player || !player.current) return msg.reply('Nothing is playing.');
    try {
      let title = player.current.info.title;
      let author = player.current.info.author;
      // Support custom search: !lyrics <title> - <artist>
      if (query && query.includes('-')) {
        const [customTitle, customAuthor] = query.split('-').map(s => s.trim());
        if (customTitle) title = customTitle;
        if (customAuthor) author = customAuthor;
      }
      const lyricsResult = await player.getLyrics({ track_name: title, artist_name: author });
      if (lyricsResult.error) {
        return msg.channel.send(`❌ Lyrics error: ${lyricsResult.error}`);
      } else if (lyricsResult.syncedLyrics) {
        // Real-time synced lyrics (LRC)
        let lyricMsg;
        let lastLine = '';
        const updateLyrics = async () => {
          if (!player.playing) return; // Stop updating if not playing
          const line = player.getCurrentLyricLine(lyricsResult.syncedLyrics, player.position);
          if (line !== lastLine) {
            lastLine = line;
            if (!lyricMsg) {
              lyricMsg = await msg.channel.send(`🎤 **Lyrics:**\n${line}`);
            } else {
              await lyricMsg.edit(`🎤 **Lyrics:**\n${line}`);
            }
          }
          if (player.playing) setTimeout(updateLyrics, 300);
        };
        updateLyrics();
      } else if (lyricsResult.lyrics) {
        // Plain lyrics
        msg.channel.send(`📄 **Lyrics for ${title}:**\n${lyricsResult.lyrics}`);
      } else {
        msg.channel.send('❌ No lyrics found.');
      }
    } catch (err) {
      msg.channel.send('❌ Could not fetch lyrics.');
    }
  }
});

// Player event listeners
tera.on('debug', (message) => {
  console.log(`[Debug] ${message}`);
});

tera.on('nodeCreate', (node) => {
  console.log(`[Node] ${node.name} connected`);
});

tera.on('nodeDestroy', (node) => {
  console.log(`[Node] ${node.name} disconnected`);
});

// Player events
client.on('raw', (d) => {
  if ([
    GatewayDispatchEvents.VoiceStateUpdate,
    GatewayDispatchEvents.VoiceServerUpdate,
  ].includes(d.t)) {
    tera.updateVoiceState(d);
  }
});

tera.on('playerCreate', (player) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send('🎶 Player created and ready!');
});

tera.on('playerDestroy', (player) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send('🛑 Player destroyed.');
});

tera.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`🎵 Now playing: **${track.info.title}** by **${track.info.author}**`);
});

tera.on('trackEnd', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`⏹️ Finished: **${track.info.title}**`);
});

tera.on('queueEnd', (player) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send('🚫 Queue ended.');
});

tera.on('playerError', (player, error) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`❌ Player error: ${error.message}`);
});

client.login(DISCORD_TOKEN); 