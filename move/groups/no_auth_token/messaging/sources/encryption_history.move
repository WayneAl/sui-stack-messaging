/// Module: encryption_history
///
/// This module provides envelope encryption key management for MessagingGroup.
/// It stores encrypted DEKs (Data Encryption Keys) that have been encrypted with Seal,
/// supporting key rotation for security purposes.
///
/// ## Design
///
/// - EncryptionHistory is attached to MessagingGroup via dynamic field
/// - Stores full EncryptedObject bytes from Seal (which contain the id/namespace)
/// - Supports key rotation with version tracking
///
/// ## Usage
///
/// Use `messaging::new_with_encryption` to create a MessagingGroup with encryption enabled.
/// Use `messaging::rotate_encryption_key` to rotate keys.
///
module messaging::encryption_history;

use sui::table_vec::{Self, TableVec};

// === Error Codes ===

const EKeyVersionNotFound: u64 = 0;

// === Permission Witnesses ===

/// Permission to rotate encryption keys.
/// Automatically granted to creator when using `new_with_encryption`.
public struct EncryptionKeyRotator() has drop;

// === Structs ===

/// Key for the dynamic field attachment on MessagingGroup.
public struct EncryptionHistoryKey has copy, drop, store {}

/// Stores encryption key history for a MessagingGroup.
/// Attached as a dynamic field on MessagingGroup.
public struct EncryptionHistory has store {
    /// Sequential storage of encrypted DEKs. Index = key version.
    /// Each entry is full EncryptedObject bytes from Seal
    /// (contains: version, packageId, id, services, threshold, encryptedShares, ciphertext)
    encrypted_keys: TableVec<vector<u8>>,
}

// === Public Functions ===

/// Creates a new EncryptionHistory with an initial encrypted DEK.
///
/// # Parameters
/// - `initial_encrypted_dek`: The initial encrypted DEK bytes (full EncryptedObject from Seal)
/// - `ctx`: Transaction context
///
/// # Returns
/// - A new `EncryptionHistory` with version 0
public(package) fun new(
    initial_encrypted_dek: vector<u8>,
    ctx: &mut TxContext,
): EncryptionHistory {
    let mut encrypted_keys = table_vec::empty<vector<u8>>(ctx);
    encrypted_keys.push_back(initial_encrypted_dek);

    EncryptionHistory {
        encrypted_keys,
    }
}

/// Rotates to a new encryption key.
/// Appends the new encrypted DEK (version = length - 1 after push).
///
/// # Parameters
/// - `self`: Mutable reference to the EncryptionHistory
/// - `new_encrypted_dek`: The new encrypted DEK bytes (full EncryptedObject from Seal)
public(package) fun rotate_key(
    self: &mut EncryptionHistory,
    new_encrypted_dek: vector<u8>,
) {
    self.encrypted_keys.push_back(new_encrypted_dek);
}

/// Returns the current key version (0-indexed).
public fun current_key_version(self: &EncryptionHistory): u64 {
    self.encrypted_keys.length() - 1
}

/// Returns the encrypted DEK for a specific version.
///
/// # Aborts
/// - If the key version doesn't exist
public fun get_encrypted_key(self: &EncryptionHistory, version: u64): vector<u8> {
    assert!(version < self.encrypted_keys.length(), EKeyVersionNotFound);
    *self.encrypted_keys.borrow(version)
}

/// Returns the encrypted DEK for the current (latest) version.
public fun get_current_encrypted_key(self: &EncryptionHistory): vector<u8> {
    self.get_encrypted_key(self.current_key_version())
}

/// Returns the dynamic field key for EncryptionHistory.
/// Used by the messaging module to access the encryption history.
public fun key(): EncryptionHistoryKey {
    EncryptionHistoryKey {}
}
