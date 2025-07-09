# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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