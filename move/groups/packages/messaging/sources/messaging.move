/// Module: messaging
///
/// This module wraps the `permissions_group` library to provide messaging-specific
/// permission management. It defines messaging-specific permission types and delegates
/// to the underlying `PermissionsGroup` for core permission operations.
///
/// ## Permission Model
///
/// Base permissions (from groups library, granted to creator automatically):
/// - `PermissionsManager`: Can grant/revoke any permissions
/// - `MemberAdder`: Can add new members (with no permissions)
/// - `MemberRemover`: Can remove members
///
/// Messaging-specific permissions (defined in this module):
/// - `MessagingSender`: Can send messages
/// - `MessagingReader`: Can read/decrypt messages
/// - `MessagingDeleter`: Can delete messages
/// - `MessagingEditor`: Can edit messages
///
/// ## Security Model
///
/// - Adding a member (via `add_member`) only adds them to the roster with no permissions
/// - Granting permissions requires `PermissionsManager` permission
/// - This prevents privilege escalation where a `MemberAdder` could grant admin permissions
///
module messaging::messaging;

use groups::permissions_group::{Self, PermissionsGroup};
use messaging::encryption_history::{Self, EncryptionHistory, EncryptionKeyRotator};
use sui::derived_object;

// === Error Codes ===

const ENotPermitted: u64 = 0;

// === Witnesses ===

/// Package witness
/// Meant to be used with permission groups:
/// `permissions_group::PermissionsGroup<MessagingApp>`
public struct Messaging() has drop;

// === Permission Witnesses ===

/// Permission to send messages to the group.
/// Separate from `MessagingReader` to enable mute functionality.
public struct MessagingSender() has drop;

/// Permission to read/decrypt messages from the group.
/// Separate from `MessagingSender` to enable read-only or write-only access.
public struct MessagingReader() has drop;

/// Permission to delete messages in the group.
public struct MessagingDeleter() has drop;

/// Permission to edit messages in the group.
public struct MessagingEditor() has drop;

// === Structs ===

/// The MessagingNamespace used for address derivation
public struct MessagingNamespace has key {
    id: UID,
    groups_created: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(MessagingNamespace {
        id: object::new(ctx),
        groups_created: 0,
    });
}

// === Public Functions ===

// === Getters ===
public fun groups_created(namespace: &MessagingNamespace): u64 {
    namespace.groups_created
}

// === Package Functions ===

/// Expose `uid_mut` for claiming derived objects from other modules in this package.
public(package) fun uid_mut(namespace: &mut MessagingNamespace): &mut UID {
    &mut namespace.id
}

/// Check if a derived object already exists in the MessagingNamespace
public(package) fun exists<TKey: copy + drop + store>(
    namespace: &MessagingNamespace,
    key: TKey,
): bool {
    derived_object::exists(&namespace.id, key)
}

/// Increment the groups_created counter and return the updated value
public(package) fun increment_groups_created(self: &mut MessagingNamespace): u64 {
    let current = self.groups_created;
    self.groups_created = current + 1;
    self.groups_created
}

// === Public Functions ===

/// Creates a new messaging group with encryption enabled.
/// Returns both the PermissionsGroup and its associated EncryptionHistory.
public fun new_group(
    namespace: &mut MessagingNamespace,
    initial_encrypted_dek: vector<u8>,
    ctx: &mut TxContext,
): (PermissionsGroup<Messaging>, EncryptionHistory) {
    // 1. Increment counter and create PermissionsGroup<Messaging>
    let groups_created = namespace.increment_groups_created();
    let mut group: PermissionsGroup<Messaging> = permissions_group::new_derived<
        Messaging,
        encryption_history::PermissionsGroupTag,
    >(
        &mut namespace.id,
        encryption_history::permissions_group_tag(groups_created),
        ctx,
    );

    // 2. Grant Messaging & Encryption permissions to the creator
    let creator = ctx.sender();
    group.grant_permission<Messaging, MessagingSender>(creator, ctx);
    group.grant_permission<Messaging, MessagingReader>(creator, ctx);
    group.grant_permission<Messaging, MessagingEditor>(creator, ctx);
    group.grant_permission<Messaging, MessagingDeleter>(creator, ctx);
    group.grant_permission<Messaging, EncryptionKeyRotator>(creator, ctx);

    // 3. Create EncryptionHistory for the group
    let encryption_history = encryption_history::new(
        &mut namespace.id,
        groups_created,
        object::id(&group),
        initial_encrypted_dek,
        ctx,
    );

    (group, encryption_history)
}

/// Rotates the encryption key for a group.
/// Requires EncryptionKeyRotator permission.
public fun rotate_encryption_key(
    encryption_history: &mut EncryptionHistory,
    group: &PermissionsGroup<Messaging>,
    new_encrypted_dek: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(
        group.has_permission<Messaging, EncryptionKeyRotator>(ctx.sender()),
        ENotPermitted,
    );
    encryption_history.rotate_key(new_encrypted_dek);
}
