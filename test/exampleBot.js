const { Client, GatewayIntentBits, GatewayDispatchEvents } = require('discord.js');
const { Teralink } = require('../build');

// Replace with your bot token and Lavalink node config
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN';
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
      const result = await tera.search(query, msg.author);
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
