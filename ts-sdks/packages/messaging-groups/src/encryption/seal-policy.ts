// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { bcs } from '@mysten/sui/bcs';
import type { Transaction, TransactionResult } from '@mysten/sui/transactions';
import { isValidSuiAddress } from '@mysten/sui/utils';

import { sealApproveReader } from '../contracts/messaging/seal_policies.js';

/**
 * Defines how Seal encryption/decryption is configured for a messaging group.
 *
 * Bundles three coupled concerns:
 * 1. Which package ID to use for Seal encryption namespace
 * 2. How to build identity bytes for `seal.encrypt()`
 * 3. How to build a `seal_approve` transaction thunk for `seal.decrypt()`
 *
 * The default implementation ({@link DefaultSealPolicy}) targets
 * `messaging::seal_policies::seal_approve_reader` with identity format
 * `[groupId (32 bytes)][keyVersion (8 bytes LE u64)]`.
 *
 * Custom implementations can target any package with any identity scheme.
 * For multiple access paths (e.g., subscription + payment), implement dynamic
 * logic in {@link sealApproveThunk} — it's called lazily at decrypt time and can
 * select which `seal_approve_*` to call based on app state.
 *
 * @example
 * ```ts
 * // Custom subscription-gated policy
 * const policy: SealPolicy = {
 *   packageId: myPackageId,
 *   buildIdentity(groupId, keyVersion) {
 *     return DefaultSealPolicy.encodeIdentity(groupId, keyVersion);
 *   },
 *   sealApproveThunk(identityBytes, groupId, encryptionHistoryId) {
 *     const sub = appStore.getUserSubscription();
 *     return (tx) => tx.moveCall({
 *       target: `${myPackageId}::policies::seal_approve_subscriber`,
 *       arguments: [
 *         tx.pure.vector('u8', Array.from(identityBytes)),
 *         tx.object(sub.id),
 *         tx.object(groupId),
 *       ],
 *     });
 *   },
 * };
 * ```
 */
export interface SealPolicy {
	/** Package ID passed to `seal.encrypt()`. Must contain the `seal_approve_*` function(s). */
	readonly packageId: string;

	/**
	 * Build identity bytes for Seal encryption.
	 * Called during DEK generation (group creation + key rotation).
	 *
	 * @param groupId - The PermissionedGroup object ID (0x-prefixed hex)
	 * @param keyVersion - The key version (0-indexed, from EncryptionHistory position)
	 * @returns Identity bytes to pass to `seal.encrypt()` as the `id` parameter
	 */
	buildIdentity(groupId: string, keyVersion: bigint): Uint8Array;

	/**
	 * Build a `seal_approve` transaction thunk for Seal decryption.
	 * The returned thunk is later added to a transaction and built into
	 * the `txBytes` that Seal key servers dry-run for access control.
	 *
	 * This is called lazily at decrypt time — implement dynamic routing here
	 * for multiple access paths (e.g., check if user has subscription, else
	 * build payment tx).
	 *
	 * @param identityBytes - The identity bytes extracted from the EncryptedObject
	 * @param groupId - The PermissionedGroup object ID
	 * @param encryptionHistoryId - The EncryptionHistory object ID
	 * @returns Transaction thunk compatible with `tx.add()`
	 */
	sealApproveThunk(
		identityBytes: Uint8Array,
		groupId: string,
		encryptionHistoryId: string,
	): (tx: Transaction) => TransactionResult;
}

// === Default Identity Encoding ===

/** Length of the default Seal identity bytes: 32 (groupId) + 8 (keyVersion LE u64). */
const DEFAULT_IDENTITY_BYTES_LENGTH = 40;

/** BCS layout for the default identity bytes: `[Address (32 bytes)][u64 LE (8 bytes)]`. */
const DefaultIdentityBcs = bcs.struct('DefaultSealIdentity', {
	groupId: bcs.Address,
	keyVersion: bcs.u64(),
});

/**
 * Default seal policy using the messaging package's `seal_approve_reader`.
 *
 * Identity format: `[groupId (32 bytes)][keyVersion (8 bytes LE u64)]`
 *
 * This is used automatically when no custom `sealPolicy` is provided
 * in {@link MessagingGroupsEncryptionOptions}.
 */
export class DefaultSealPolicy implements SealPolicy {
	readonly packageId: string;

	constructor(packageId: string) {
		this.packageId = packageId;
	}

	/**
	 * Encode groupId + keyVersion into the 40-byte identity format.
	 *
	 * Layout: `[group_id (32 bytes)][key_version (8 bytes LE u64)]`
	 *
	 * @param groupId - 0x-prefixed hex Sui address (validated)
	 * @param keyVersion - Encryption key version (0-indexed)
	 * @throws if `groupId` is not a valid Sui address
	 */
	static encodeIdentity(groupId: string, keyVersion: bigint): Uint8Array {
		if (!isValidSuiAddress(groupId)) {
			throw new Error(`Invalid groupId: expected a valid Sui address, got "${groupId}"`);
		}
		return DefaultIdentityBcs.serialize({ groupId, keyVersion }).toBytes();
	}

	/**
	 * Decode 40 identity bytes back into groupId and keyVersion.
	 *
	 * @throws if `bytes.length !== 40`
	 */
	static decodeIdentity(bytes: Uint8Array): { groupId: string; keyVersion: bigint } {
		if (bytes.length !== DEFAULT_IDENTITY_BYTES_LENGTH) {
			throw new Error(
				`Invalid identity bytes length: expected ${DEFAULT_IDENTITY_BYTES_LENGTH}, got ${bytes.length}`,
			);
		}
		const parsed = DefaultIdentityBcs.parse(bytes);
		return { groupId: parsed.groupId, keyVersion: BigInt(parsed.keyVersion) };
	}

	buildIdentity(groupId: string, keyVersion: bigint): Uint8Array {
		return DefaultSealPolicy.encodeIdentity(groupId, keyVersion);
	}

	sealApproveThunk(
		identityBytes: Uint8Array,
		groupId: string,
		encryptionHistoryId: string,
	): (tx: Transaction) => TransactionResult {
		return sealApproveReader({
			package: this.packageId,
			arguments: {
				id: Array.from(identityBytes),
				group: groupId,
				encryptionHistory: encryptionHistoryId,
			},
		});
	}
}
