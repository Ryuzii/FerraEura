const { getImageUrl } = require("../handlers/fetchImage");
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class Track {
    constructor(data, requester, node) {
        this.rawData = data;
        this.track = data.encoded;
        this.info = {
            identifier: data.info.identifier,
            seekable: data.info.isSeekable,
            author: data.info.author,
            length: data.info.length,
            stream: data.info.isStream,
            position: data.info.position,
            title: data.info.title,
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
     * @returns {Promise<Track>}
     */
    async resolve(tera) {
        const result = await tera.resolve({ query: this.info.identifier, source: tera.options.defaultSearchPlatform, requester: this.info.requester });
        if (result && result.tracks && result.tracks.length > 0) {
            return result.tracks[0];
        }
        return this;
    }
}

module.exports = { Track }; 