//! Membership snapshot service: saves and loads the membership store to/from disk.
//!
//! This solves the restart problem: the in-memory store is wiped on every restart,
//! and the gRPC checkpoint subscription has no cursor — it cannot replay past events.
//! By periodically snapshotting to a JSON file and loading it on startup, the relayer
//! survives restarts without losing group membership state.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::time::{Duration, interval};
use tracing::{error, info, warn};

use crate::auth::{MembershipStore, MessagingPermission};

#[derive(Serialize, Deserialize)]
struct SnapshotEntry {
    group_id: String,
    members: Vec<SnapshotMember>,
}

#[derive(Serialize, Deserialize)]
struct SnapshotMember {
    address: String,
    permissions: Vec<MessagingPermission>,
}

#[derive(Serialize, Deserialize)]
struct MembershipSnapshot {
    groups: Vec<SnapshotEntry>,
}

/// Loads membership state from a snapshot file into the store.
/// Logs and returns early (without panicking) if the file is missing or malformed.
pub fn load_snapshot(path: &str, store: &Arc<dyn MembershipStore>) {
    let p = Path::new(path);
    if !p.exists() {
        info!("No membership snapshot at '{}', starting with empty store", path);
        return;
    }

    let content = match std::fs::read_to_string(p) {
        Ok(c) => c,
        Err(e) => {
            warn!("Could not read membership snapshot '{}': {}", path, e);
            return;
        }
    };

    let snapshot: MembershipSnapshot = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(e) => {
            warn!("Could not parse membership snapshot '{}': {}", path, e);
            return;
        }
    };

    let mut total_members = 0usize;
    for entry in &snapshot.groups {
        let members_with_perms: Vec<(String, Vec<MessagingPermission>)> = entry
            .members
            .iter()
            .map(|m| (m.address.clone(), m.permissions.clone()))
            .collect();
        total_members += members_with_perms.len();
        store.set_group_members(&entry.group_id, members_with_perms);
    }

    info!(
        "Loaded membership snapshot: {} group(s), {} member(s) restored from '{}'",
        snapshot.groups.len(),
        total_members,
        path
    );
}

/// Saves the current membership store state to a snapshot file.
fn save_snapshot(path: &str, store: &Arc<dyn MembershipStore>) {
    let all: HashMap<String, Vec<(String, Vec<MessagingPermission>)>> = store.get_all_groups();

    let snapshot = MembershipSnapshot {
        groups: all
            .into_iter()
            .map(|(group_id, members)| SnapshotEntry {
                group_id,
                members: members
                    .into_iter()
                    .map(|(address, permissions)| SnapshotMember {
                        address,
                        permissions,
                    })
                    .collect(),
            })
            .collect(),
    };

    let json = match serde_json::to_string_pretty(&snapshot) {
        Ok(j) => j,
        Err(e) => {
            error!("Failed to serialize membership snapshot: {}", e);
            return;
        }
    };

    if let Err(e) = std::fs::write(path, json) {
        error!("Failed to write membership snapshot to '{}': {}", path, e);
    } else {
        let total: usize = snapshot.groups.iter().map(|g| g.members.len()).sum();
        info!(
            "Saved membership snapshot: {} group(s), {} member(s) to '{}'",
            snapshot.groups.len(),
            total,
            path
        );
    }
}

/// Runs in the background, periodically saving the membership store to disk.
pub async fn run_snapshot_loop(
    path: String,
    store: Arc<dyn MembershipStore>,
    interval_secs: u64,
) {
    info!(
        "Membership snapshot enabled: saving to '{}' every {}s",
        path, interval_secs
    );

    let mut ticker = interval(Duration::from_secs(interval_secs));
    ticker.tick().await; // skip the immediate first tick

    loop {
        ticker.tick().await;
        save_snapshot(&path, &store);
    }
}
