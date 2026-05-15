//! Walrus restore service: loads messages from Walrus back into storage on startup.
//!
//! On every sync cycle, WalrusSyncService appends the quilt blob ID to a registry file.
//! On startup, this service reads that registry, fetches each quilt from Walrus,
//! deserializes the message patches, and inserts them into storage.
//!
//! This solves the restart problem: in-memory storage is wiped on restart, but
//! Walrus is the durable source of truth for synced messages.

use std::sync::Arc;

use tracing::{info, warn};

use crate::models::Message;
use crate::storage::StorageAdapter;
use crate::walrus::WalrusClient;

/// Prefix for message patches stored in Walrus quilts.
const MSG_PREFIX: &str = "msg-";

/// Reads the quilt registry file and returns all stored blob IDs.
fn load_quilt_registry(registry_path: &str) -> Vec<String> {
    match std::fs::read_to_string(registry_path) {
        Ok(content) => serde_json::from_str::<Vec<String>>(&content).unwrap_or_else(|e| {
            warn!(
                "Could not parse quilt registry '{}': {}",
                registry_path, e
            );
            vec![]
        }),
        Err(_) => {
            info!(
                "No quilt registry found at '{}', skipping Walrus restore",
                registry_path
            );
            vec![]
        }
    }
}

/// Restores messages from all registered Walrus quilts into storage.
/// Runs once on startup before the HTTP server begins accepting requests.
pub async fn restore_from_walrus(
    registry_path: &str,
    walrus_client: &Arc<WalrusClient>,
    storage: &Arc<dyn StorageAdapter>,
) {
    let blob_ids = load_quilt_registry(registry_path);
    if blob_ids.is_empty() {
        info!("Quilt registry is empty, no messages to restore from Walrus");
        return;
    }

    info!(
        "Restoring messages from {} Walrus quilt(s) listed in '{}'",
        blob_ids.len(),
        registry_path
    );

    let mut total_restored = 0usize;
    let mut total_skipped = 0usize;

    for blob_id in &blob_ids {
        match walrus_client.list_patches(blob_id).await {
            Ok(patches) => {
                for patch in patches {
                    // Only process message patches (identifier starts with "msg-")
                    if !patch.identifier.starts_with(MSG_PREFIX) {
                        continue;
                    }

                    match walrus_client.read_by_patch_id(&patch.patch_id).await {
                        Ok(bytes) => match serde_json::from_slice::<Message>(&bytes) {
                            Ok(message) => {
                                match storage.restore_message(message).await {
                                    Ok(()) => total_restored += 1,
                                    Err(e) => {
                                        warn!("Failed to restore message from patch {}: {}", patch.patch_id, e);
                                    }
                                }
                            }
                            Err(e) => {
                                warn!(
                                    "Failed to deserialize message from patch {}: {}",
                                    patch.patch_id, e
                                );
                            }
                        },
                        Err(e) => {
                            warn!("Failed to read patch {} from Walrus: {}", patch.patch_id, e);
                            total_skipped += 1;
                        }
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Failed to list patches for quilt {} (may have expired): {}",
                    blob_id, e
                );
                total_skipped += 1;
            }
        }
    }

    info!(
        "Walrus restore complete: {} message(s) restored, {} quilt(s) skipped",
        total_restored, total_skipped
    );
}
