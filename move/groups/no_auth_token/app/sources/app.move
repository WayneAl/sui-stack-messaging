/// Module: app
///
/// Example third-party app contract demonstrating how to wrap MessagingGroup
/// with custom functionality:
/// - Paid membership (join fee)
/// - Custom seal_approve
/// - (TODO) Temporary mute feature
///
/// This serves as a reference implementation for app developers who want to
/// extend the messaging package with custom gating logic.
///
/// ## Pattern
///
/// When wrapping MessagingGroup, you need to:
/// 1. Create a wrapper struct that embeds MessagingGroup
/// 2. Implement custom logic (e.g., paid join, custom seal_approve)
/// 3. Expose wrapper functions for all MessagingGroup functions you want to allow
/// 4. Use your app's packageId for Seal encryption (not messaging's)
///
/// ## Important Notes
///
/// - You cannot mix messaging::seal_policies with your custom seal_approve
/// - All encryption must use your app's packageId since seal_approve lives here
/// - The wrapper pattern requires explicit pass-through for all desired functions
///
module app::app;

use messaging::messaging::{Self, MessagingGroup, MessagingSender, MessagingReader};
use sui::coin::Coin;
use sui::sui::SUI;

// === Error Codes ===

const EInsufficientPayment: u64 = 0;
const EInvalidNamespace: u64 = 1;
const ENotMember: u64 = 2;

// === Structs ===

/// A paid messaging group that wraps MessagingGroup.
/// Requires payment to join.
public struct PaidGroup has key {
    id: UID,
    inner: MessagingGroup,
    /// Fee required to join this group (in MIST)
    join_fee: u64,
}

// === Constructor ===

/// Creates a new PaidGroup with encryption enabled.
///
/// # Parameters
/// - `join_fee`: The fee in MIST required to join this group
/// - `initial_encrypted_dek`: The initial encrypted DEK bytes (full EncryptedObject from Seal)
/// - `ctx`: Transaction context
public fun new(
    join_fee: u64,
    initial_encrypted_dek: vector<u8>,
    ctx: &mut TxContext,
): PaidGroup {
    let inner = messaging::new_with_encryption(initial_encrypted_dek, ctx);

    PaidGroup {
        id: object::new(ctx),
        inner,
        join_fee,
    }
}

// === Custom Join Logic ===

/// Join the group by paying the required fee.
/// The caller becomes a member with MessagingSender and MessagingReader permissions.
///
/// # Parameters
/// - `self`: Mutable reference to the PaidGroup
/// - `payment`: Coin payment (must be >= join_fee)
/// - `ctx`: Transaction context
///
/// # Aborts
/// - If payment is less than join_fee
public fun join(
    self: &mut PaidGroup,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(payment.value() >= self.join_fee, EInsufficientPayment);

    // Add the caller as a member
    self.inner.add_member(ctx.sender(), ctx);

    // Grant messaging permissions
    self.inner.grant_permission<MessagingSender>(ctx.sender(), ctx);
    self.inner.grant_permission<MessagingReader>(ctx.sender(), ctx);

    // Transfer payment to group creator
    transfer::public_transfer(payment, self.inner.creator());
}

// === Wrapper Functions: Membership ===

/// Removes a member from the PaidGroup.
/// Requires the caller to have MemberRemover permission.
public fun remove_member(self: &mut PaidGroup, member: address, ctx: &TxContext) {
    self.inner.remove_member(member, ctx);
}

/// Allows the calling member to leave the PaidGroup.
public fun leave(self: &mut PaidGroup, ctx: &TxContext) {
    self.inner.leave(ctx);
}

// === Wrapper Functions: Permissions ===

/// Grants a permission to an existing member.
/// Requires the caller to have PermissionsManager permission.
public fun grant_permission<Permission: drop>(
    self: &mut PaidGroup,
    member: address,
    ctx: &TxContext,
) {
    self.inner.grant_permission<Permission>(member, ctx);
}

/// Revokes a permission from a member.
/// Requires the caller to have PermissionsManager permission.
public fun revoke_permission<Permission: drop>(
    self: &mut PaidGroup,
    member: address,
    ctx: &TxContext,
) {
    self.inner.revoke_permission<Permission>(member, ctx);
}

/// Checks if the caller has the specified permission.
public fun is_authorized<Permission: drop>(self: &PaidGroup, ctx: &TxContext): bool {
    self.inner.is_authorized<Permission>(ctx)
}

/// Checks if an address has the specified permission.
public fun has_permission<Permission: drop>(self: &PaidGroup, member: address): bool {
    self.inner.has_permission<Permission>(member)
}

// === Wrapper Functions: Encryption ===

/// Rotates the encryption key for this PaidGroup.
/// Requires the caller to have EncryptionKeyRotator permission.
public fun rotate_encryption_key(
    self: &mut PaidGroup,
    new_encrypted_dek: vector<u8>,
    ctx: &TxContext,
) {
    self.inner.rotate_encryption_key(new_encrypted_dek, ctx);
}

/// Returns the current encryption key version.
public fun current_encryption_key_version(self: &PaidGroup): u64 {
    self.inner.current_encryption_key_version()
}

/// Returns the encrypted DEK for a specific version.
public fun get_encrypted_key(self: &PaidGroup, version: u64): vector<u8> {
    self.inner.get_encrypted_key(version)
}

/// Returns the encrypted DEK for the current (latest) version.
public fun get_current_encrypted_key(self: &PaidGroup): vector<u8> {
    self.inner.get_current_encrypted_key()
}

/// Checks if encryption is enabled for this PaidGroup.
public fun has_encryption(self: &PaidGroup): bool {
    self.inner.has_encryption()
}

// === Wrapper Functions: Getters ===

/// Returns the join fee for this group.
public fun join_fee(self: &PaidGroup): u64 {
    self.join_fee
}

/// Returns whether the given address is a member.
public fun is_member(self: &PaidGroup, member: address): bool {
    self.inner.is_member(member)
}

/// Returns the creator address of the underlying MessagingGroup.
public fun creator(self: &PaidGroup): address {
    self.inner.creator()
}

// === Seal Approve Functions ===

/// Validates that the id has the correct namespace prefix (creator address).
fun check_namespace(group: &PaidGroup, id: &vector<u8>): bool {
    let namespace = group.inner.creator().to_bytes();
    let namespace_len = namespace.length();

    if (namespace_len > id.length()) {
        return false
    };

    let mut i = 0;
    while (i < namespace_len) {
        if (namespace[i] != id[i]) {
            return false
        };
        i = i + 1;
    };
    true
}

/// Custom seal_approve that checks membership in the PaidGroup.
///
/// NOTE: When using this seal_approve, you must use the app package's
/// packageId during Seal encryption, NOT the messaging package's packageId.
/// You cannot mix this with messaging::seal_policies functions.
///
/// # Parameters
/// - `id`: The Seal identity bytes (should be [creator_address][nonce])
/// - `group`: Reference to the PaidGroup
/// - `ctx`: Transaction context
///
/// # Aborts
/// - If id doesn't have correct namespace prefix (creator address)
/// - If caller is not a member
entry fun seal_approve(
    id: vector<u8>,
    group: &PaidGroup,
    ctx: &TxContext,
) {
    assert!(check_namespace(group, &id), EInvalidNamespace);
    assert!(group.inner.is_member(ctx.sender()), ENotMember);
}
