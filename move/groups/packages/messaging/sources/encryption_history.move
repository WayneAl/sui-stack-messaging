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
/// Use `messaging::new_group` to create a MessagingGroup with encryption enabled.
/// Use `messaging::rotate_encryption_key` to rotate keys.
///
module messaging::encryption_history;

use sui::derived_object;
use sui::table_vec::{Self, TableVec};

// === Error Codes ===

const EEncryptionHistoryAlreadyExists: u64 = 0;
const EKeyVersionNotFound: u64 = 1;

// === Derivation Keys ===

/// derived from MessagingNamespace + EncryptionHistoryTag(u64)
public struct EncryptionHistoryTag(u64) has copy, drop, store;
/// derived from MessagingNamespace + PermissionsGroupTag(u64)
public struct PermissionsGroupTag(u64) has copy, drop, store;

// === Permission Witnesses ===

/// Permission to rotate encryption keys.
/// Should be granted to PermissionsGroup<Messaging> creator during creation.
public struct EncryptionKeyRotator() has drop;

// === Structs ===

/// Stores encryption key history for a PermissionsGroup<Messaging>.
/// Derived from the MessagingNamespace + PermissionsGroup<Messaging> ID.
/// There should be 1 PermissionsGroup<Messaging> <-> 1 EncryptionHistory pair.
public struct EncryptionHistory has key, store {
    id: UID,
    /// The ID of the associated PermissionsGroup<Messaging>
    group_id: ID,
    group_index: u64,
    /// Sequential storage of encrypted DEKs. Index = key version.
    /// Each entry is full EncryptedObject bytes from Seal
    /// (contains: version, packageId, id, services, threshold, encryptedShares, ciphertext)
    encrypted_keys: TableVec<vector<u8>>,
}

// === Package Functions ===

/// Creates a new EncryptionHistory for a group.
/// Called by the messaging module when creating a new group.
public(package) fun new(
    namespace_uid: &mut UID,
    groups_created: u64,
    group_id: ID,
    initial_encrypted_dek: vector<u8>,
    ctx: &mut TxContext,
): EncryptionHistory {
    assert!(
        !derived_object::exists(namespace_uid, EncryptionHistoryTag(groups_created)),
        EEncryptionHistoryAlreadyExists,
    );
    let mut encrypted_keys = table_vec::empty<vector<u8>>(ctx);
    encrypted_keys.push_back(initial_encrypted_dek);

    EncryptionHistory {
        id: derived_object::claim(
            namespace_uid,
            EncryptionHistoryTag(groups_created),
        ),
        group_index: groups_created - 1, // keep it 0-based
        group_id,
        encrypted_keys,
    }
}

/// Rotates to a new encryption key.
/// Appends the new encrypted DEK (version = length - 1 after push).
/// Security check must be performed by the caller (messaging module).
public(package) fun rotate_key(
    self: &mut EncryptionHistory,
    new_encrypted_dek: vector<u8>,
) {
    self.encrypted_keys.push_back(new_encrypted_dek);
}

// === Getters ===

/// Returns the associated PermissionsGroup ID.
public fun group_id(self: &EncryptionHistory): ID {
    self.group_id
}

/// Returns the current key version (0-indexed).
public fun current_key_version(self: &EncryptionHistory): u64 {
    self.encrypted_keys.length() - 1
}

/// Returns the encrypted DEK for a specific version.
///
/// # Aborts
/// - If the key version doesn't exist.
public fun encrypted_key(self: &EncryptionHistory, version: u64): &vector<u8> {
    assert!(version < self.encrypted_keys.length(), EKeyVersionNotFound);
    self.encrypted_keys.borrow(version)
}

/// Returns the encrypted DEK for the current (latest) version.
public fun current_encrypted_key(self: &EncryptionHistory): &vector<u8> {
    self.encrypted_key(self.current_key_version())
}

/// Returns the PermissionsGroupTag for deriving group addresses.
/// Used by the messaging module.
public(package) fun permissions_group_tag(index: u64): PermissionsGroupTag {
    PermissionsGroupTag(index)
}
