const { getImageUrl } = require("../handlers/fetchImage");

class Track {
    constructor(data, requester, node) {
        this.rawData = data;
        this.track = data.encoded;
        // Helper to check for garbled (Morse code) or missing text
        const isGarbled = (text) => !text || /^[\s･－]+$/.test(text);
        // Try to get the best possible title/author
        let title = data.info.title;
        let author = data.info.author;
        // Try alternative fields if garbled or missing
        if (isGarbled(title)) {
            if (data.info.metadata && data.info.metadata.title) title = data.info.metadata.title;
            else if (data.info.album) title = data.info.album;
            else if (data.info.name) title = data.info.name;
        }
        if (isGarbled(author)) {
            if (data.info.metadata && data.info.metadata.artist) author = data.info.metadata.artist;
            else if (Array.isArray(data.info.artists) && data.info.artists.length > 0) author = data.info.artists.join(', ');
            else if (data.info.artist) author = data.info.artist;
        }
        // Debug log if still garbled
        if (isGarbled(title) || isGarbled(author)) {
            if (node && node.tera && typeof node.tera.emit === 'function') {
                node.tera.emit('debug', `Track metadata garbled or missing. Raw data: ${JSON.stringify(data.info)}`);
            }
        }
        this.info = {
            identifier: data.info.identifier,
            seekable: data.info.isSeekable,
            author,
            length: data.info.length,
            stream: data.info.isStream,
            position: data.info.position,
            title,
            uri: data.info.uri,
            requester,
            sourceName: data.info.sourceName,
            isrc: data.info?.isrc || null,
            _cachedThumbnail: data.info.thumbnail ?? null,
            get thumbnail() {
            if (data.info.thumbnail) return data.info.thumbnail;

            if (node.rest.version === "v4") {
                if (data.info.artworkUrl) {
                  this._cachedThumbnail = data.info.artworkUrl;
                  return data.info.artworkUrl
               } else {
                  return !this._cachedThumbnail ? (this._cachedThumbnail = getImageUrl(this)) : this._cachedThumbnail ?? null
               }
              } else {
              return !this._cachedThumbnail
                ? (this._cachedThumbnail = getImageUrl(this))
                : this._cachedThumbnail ?? null;
              }
            }
        };
    }

    /**
     * Resolve this track using the Teralink instance.
     * @param {Teralink} tera - The Teralink instance
     * @returns {Promise<Track|undefined>}
     */
    async resolve(tera) {
        await new Promise((res) => setTimeout(res, 0));

        const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const query = [this.info.author, this.info.title].filter((x) => !!x).join(" - ");
        const result = await tera.resolve({ query, source: tera.options.defaultSearchPlatform, requester: this.info.requester });

        if (!result || !result.tracks.length) {
            return;
        }

        const officialAudio = result.tracks.find((track) => {
            const author = [this.info.author, `${this.info.author} - Topic`];
            return author.some((name) => new RegExp(`^${escapeRegExp(name)}$`, "i").test(track.info.author)) ||
                new RegExp(`^${escapeRegExp(this.info.title)}$`, "i").test(track.info.title);
        });

        if (officialAudio) {
            this.info.identifier = officialAudio.info.identifier;
            this.track = officialAudio.track;
            return this;
        }

        if (this.info.length) {
            const sameDuration = result.tracks.find((track) => track.info.length >= (this.info.length ? this.info.length : 0) - 2000 &&
                track.info.length <= (this.info.length ? this.info.length : 0) + 2000);

            if (sameDuration) {
                this.info.identifier = sameDuration.info.identifier;
                this.track = sameDuration.track;
                return this;
            }

            const sameDurationAndTitle = result.tracks.find((track) => track.info.title === this.info.title && track.info.length >= (this.info.length ? this.info.length : 0) - 2000 && track.info.length <= (this.info.length ? this.info.length : 0) + 2000);

            if (sameDurationAndTitle) {
                this.info.identifier = sameDurationAndTitle.info.identifier;
                this.track = sameDurationAndTitle.track;
                return this;
            }
        }

        this.info.identifier = result.tracks[0].info.identifier;
        this.track = result.tracks[0].track;
        return this;
    }
}

module.exports = { Track }; 