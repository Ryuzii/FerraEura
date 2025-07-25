class Queue extends Array {
    get size() {
        return this.length;
    }
    get first() {
        return this.length ? this[0] : null;
    }
    get last() {
        return this.length ? this[this.length - 1] : null;
    }
    add(track) {
        if (!track) return this;
        this.push(track);
        return this;
    }
    addMultiple(tracks) {
        if (Array.isArray(tracks)) {
            this.push(...tracks);
        }
        return this;
    }
    remove(index) {
        if (index < 0 || index >= this.length) return null;
        return this.splice(index, 1)[0];
    }
    clear() {
        this.length = 0;
    }
    shuffle() {
        if (this.length <= 1) return this;
        for (let i = this.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this[i], this[j]] = [this[j], this[i]];
        }
        return this;
    }
    async shuffleAsync() {
        if (this.length <= 1) return this;
        const chunkSize = 1000;
        for (let i = 0; i < this.length; i += chunkSize) {
            const end = Math.min(i + chunkSize, this.length);
            for (let j = end - 1; j > i; j--) {
                const k = i + Math.floor(Math.random() * (j - i + 1));
                [this[j], this[k]] = [this[k], this[j]];
            }
            if (i + chunkSize < this.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        return this;
    }
    move(from, to) {
        if (from < 0 || from >= this.length || to < 0 || to >= this.length) return this;
        const item = this.splice(from, 1)[0];
        this.splice(to, 0, item);
        return this;
    }
    getRange(start, end) {
        if (start < 0) start = 0;
        if (end > this.length) end = this.length;
        if (start >= end) return [];
        return this.slice(start, end);
    }
    findTrack(criteria) {
        if (typeof criteria === 'function') {
            return this.find(criteria);
        }
        if (typeof criteria === 'string') {
            return this.find(track => 
                track.info.title.toLowerCase().includes(criteria.toLowerCase()) ||
                track.info.author.toLowerCase().includes(criteria.toLowerCase())
            );
        }
        return null;
    }
    removeTracks(criteria) {
        const removed = [];
        const remaining = [];
        for (const track of this) {
            if (typeof criteria === 'function') {
                if (criteria(track)) {
                    removed.push(track);
                } else {
                    remaining.push(track);
                }
            } else if (typeof criteria === 'string') {
                if (track.info.title.toLowerCase().includes(criteria.toLowerCase()) ||
                    track.info.author.toLowerCase().includes(criteria.toLowerCase())) {
                    removed.push(track);
                } else {
                    remaining.push(track);
                }
            }
        }
        this.length = 0;
        this.push(...remaining);
        return removed;
    }
    getStats() {
        if (this.length === 0) {
            return {
                totalTracks: 0,
                totalDuration: 0,
                averageDuration: 0,
                uniqueArtists: 0,
                uniqueSources: 0,
                sources: [],
                uniqueRequesters: 0,
                estimatedPlaytime: '0:00'
            };
        }
        
        const totalDuration = this.reduce((sum, track) => sum + (track.info?.length || 0), 0);
        const uniqueArtists = new Set(this.map(track => track.info?.author).filter(Boolean)).size;
        const uniqueSources = new Set(this.map(track => track.info?.sourceName).filter(Boolean)).size;
        const requesters = new Set();
        
        this.forEach(track => {
            if (track.info?.requester) {
                requesters.add(track.info.requester.id || track.info.requester);
            }
        });
        
        return {
            totalTracks: this.length,
            totalDuration,
            averageDuration: this.length > 0 ? Math.round(totalDuration / this.length) : 0,
            uniqueArtists,
            uniqueSources,
            sources: Array.from(new Set(this.map(track => track.info?.sourceName).filter(Boolean))),
            uniqueRequesters: requesters.size,
            estimatedPlaytime: this.formatDuration(totalDuration)
        };
    }
    
    /**
     * Enhanced search within the queue
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Matching tracks with their indices
     */
    searchAdvanced(query, options = {}) {
        const { limit = 10, fuzzy = true } = options;
        const normalizedQuery = query.toLowerCase();
        const results = [];
        
        for (let i = 0; i < this.length && results.length < limit; i++) {
            const track = this[i];
            const title = track.info?.title?.toLowerCase() || '';
            const author = track.info?.author?.toLowerCase() || '';
            
            let score = 0;
            
            // Exact matches get highest score
            if (title.includes(normalizedQuery) || author.includes(normalizedQuery)) {
                score = 100;
            } else if (fuzzy) {
                // Simple fuzzy matching
                const titleWords = title.split(' ');
                const authorWords = author.split(' ');
                const queryWords = normalizedQuery.split(' ');
                
                queryWords.forEach(queryWord => {
                    titleWords.forEach(titleWord => {
                        if (titleWord.includes(queryWord) || queryWord.includes(titleWord)) {
                            score += 50;
                        }
                    });
                    authorWords.forEach(authorWord => {
                        if (authorWord.includes(queryWord) || queryWord.includes(authorWord)) {
                            score += 30;
                        }
                    });
                });
            }
            
            if (score > 0) {
                results.push({ track, index: i, score });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }
    
    /**
     * Remove duplicates from queue
     * @param {string} [criteria='uri'] - Criteria for duplicate detection
     * @returns {number} Number of duplicates removed
     */
    removeDuplicates(criteria = 'uri') {
        const seen = new Set();
        const toRemove = [];
        
        for (let i = 0; i < this.length; i++) {
            const track = this[i];
            let key;
            
            switch (criteria) {
                case 'uri':
                    key = track.info?.uri;
                    break;
                case 'title':
                    key = track.info?.title?.toLowerCase();
                    break;
                case 'identifier':
                    key = track.info?.identifier;
                    break;
                default:
                    key = track.info?.uri;
            }
            
            if (key && seen.has(key)) {
                toRemove.push(i);
            } else if (key) {
                seen.add(key);
            }
        }
        
        // Remove duplicates in reverse order to maintain indices
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.splice(toRemove[i], 1);
        }
        
        return toRemove.length;
    }
    
    /**
     * Format duration in milliseconds to human readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    reverse() {
        this.reverse();
        return this;
    }
    getBySource(source) {
        return this.filter(track => track.info.sourceName === source);
    }
    getByArtist(artist) {
        return this.filter(track => 
            track.info.author.toLowerCase().includes(artist.toLowerCase())
        );
    }
    getByTitle(title) {
        return this.filter(track => 
            track.info.title.toLowerCase().includes(title.toLowerCase())
        );
    }
    insert(index, track) {
        if (index < 0) index = 0;
        if (index > this.length) index = this.length;
        this.splice(index, 0, track);
        return this;
    }
    swap(index1, index2) {
        if (index1 < 0 || index1 >= this.length || index2 < 0 || index2 >= this.length) return this;
        [this[index1], this[index2]] = [this[index2], this[index1]];
        return this;
    }
    getRandom() {
        if (this.length === 0) return null;
        return this[Math.floor(Math.random() * this.length)];
    }
    getRandomMultiple(count) {
        if (count >= this.length) return [...this];
        const shuffled = [...this];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count);
    }
    toArray() {
        return Array.from(this);
    }
    toJSON() {
        return this.map(track => track.toJSON ? track.toJSON() : track);
    }
    static from(array) {
        const queue = new Queue();
        if (Array.isArray(array)) {
            queue.push(...array);
        }
        return queue;
    }
    addBatch(tracks) {
        if (!Array.isArray(tracks) || tracks.length === 0) return this;
        this.push(...tracks);
        return this;
    }
    addPlaylist(tracks, playlistInfo = null) {
        if (!Array.isArray(tracks) || tracks.length === 0) return this;
        const startIndex = this.length;
        this.length += tracks.length;
        for (let i = 0; i < tracks.length; i++) {
            this[startIndex + i] = tracks[i];
        }
        return this;
    }
}

module.exports = { Queue }; 