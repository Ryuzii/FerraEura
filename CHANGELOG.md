# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.0] - 2025-01-23
### Added
- **🧠 Smart Search System**
  - `smartSearch()` method with automatic source detection from URLs
  - Query enhancement that removes interfering words for better results
  - `batchSearch()` for searching multiple queries efficiently
  - Support for YouTube, Spotify, SoundCloud, and Bandcamp URL detection

- **📊 Performance Monitoring**
  - `getPerformanceMetrics()` method returning cache hit rates, memory usage, and search statistics
  - `getMemoryUsage()` for detailed memory reporting
  - `resetPerformanceMetrics()` for metric reset functionality
  - Real-time performance tracking with automatic metrics collection

- **🧹 Automatic Memory Management**
  - Intelligent memory cleanup with configurable thresholds (default: 85% heap usage)
  - Automatic cleanup intervals (default: 5 minutes)
  - `performMemoryCleanup()` for manual cleanup
  - `startMemoryManagement()` and `stopMemoryManagement()` for control
  - Memory leak prevention and garbage collection optimization

- **🛡️ Enhanced Error Handling**
  - Intelligent retry logic with exponential backoff for network errors
  - `shouldRetryError()` method for error classification
  - Maximum 3 retry attempts with increasing delays (100ms, 200ms, 400ms)
  - Automatic retry for timeout, network, and connection errors

- **📋 Advanced Queue Management**
  - `getStats()` method returning comprehensive queue analytics
  - `searchAdvanced()` with fuzzy matching and relevance scoring
  - `removeDuplicates()` with configurable deduplication strategies
  - `shuffleAsync()` for non-blocking shuffle operations
  - `formatDuration()` utility for human-readable time formatting
  - Queue filtering by source, duration, and other criteria

- **📈 Enhanced Caching**
  - Increased cache size from 1000 to 2500 entries
  - Extended TTL from 15 minutes to 30 minutes
  - Improved cache hit rate monitoring
  - Better cache eviction strategies

- **🔧 Node Health Monitoring**
  - `getHealthStatus()` method for detailed node health information
  - `isHealthy()` boolean check for node status
  - Connection stability tracking and consecutive failure monitoring
  - Average ping calculation and health scoring

- **📚 Comprehensive Documentation**
  - Complete HTML documentation with interactive navigation
  - API reference with detailed method signatures
  - Code examples and usage patterns
  - Migration guide from v0.1.x to v0.2.0

### Enhanced
- **Performance Optimizations**
  - 2.5x larger cache size for better hit rates
  - Improved memory usage with automatic cleanup
  - Enhanced error handling reduces failed requests
  - Better connection stability and retry mechanisms

- **Developer Experience**
  - Enhanced TypeScript definitions for all new features
  - Comprehensive documentation with examples
  - Better error messages and debugging information
  - Improved method naming and consistency

- **Reliability Improvements**
  - Automatic memory management prevents memory leaks
  - Intelligent error handling reduces service interruptions
  - Better node health monitoring for failover decisions
  - Enhanced queue management with duplicate prevention

### Changed
- Cache configuration: increased size and TTL for better performance
- Memory management: now automatic by default with configurable thresholds
- Error handling: enhanced with retry logic and better classification
- Documentation: completely rewritten with comprehensive examples

### Fixed
- Memory leaks in long-running applications
- Network error handling edge cases
- Queue management performance issues
- TypeScript definition completeness

## [0.1.1-rc.2] - 2025-08-08
### Added
- Automatic player migration (failover): When a Lavalink node goes offline and dynamicSwitching is enabled, all affected players are automatically moved to a healthy node and playback resumes from the last position.
### Changed
- Refactored Teralink options to a clean, nested structure (source, rest, resume, node, lazyLoad, etc.) for easier setup and customization
- Added intelligent caching for super-fast track and playlist resolution
- Optimized memory and CPU usage: added cache pruning, event listener and timer cleanup for long-running, high-traffic bots
- Reviewed and optimized loops and data structures for performance
- Enhanced event system for full control and customization
- Updated all code samples and documentation to use the new config style and highlight these improvements 