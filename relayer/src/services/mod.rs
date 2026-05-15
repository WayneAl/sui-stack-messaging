//! Background services for the relayer.
//! This module contains services that run alongside the HTTP server:
//! - `event_parser`: Parses Sui blockchain events into domain types
//! - `membership_sync`: Subscribes to Sui checkpoints and syncs membership cache
//! - `membership_snapshot`: Saves/loads membership store to/from disk across restarts
//! - `walrus_sync`: Periodically uploads pending messages to Walrus storage
//! - `walrus_restore`: Restores messages from Walrus quilts into storage on startup

pub mod event_parser;
pub mod membership_snapshot;
pub mod membership_sync;
pub mod walrus_restore;
pub mod walrus_sync;

pub use membership_snapshot::{load_snapshot, run_snapshot_loop};
pub use membership_sync::MembershipSyncService;
pub use walrus_restore::restore_from_walrus;
pub use walrus_sync::WalrusSyncService;
