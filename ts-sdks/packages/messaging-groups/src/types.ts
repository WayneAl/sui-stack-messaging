// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { PermissionedGroupsClient } from '@mysten/permissioned-groups';
import type { SealClient } from '@mysten/seal';
import type { Signer } from '@mysten/sui/cryptography';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import type { TransactionArgument } from '@mysten/sui/transactions';

import type { CryptoPrimitives } from './encryption/crypto-primitives.js';

// === Package Configuration ===

/**
 * Configuration for the messaging Move package.
 * This is managed by us and provided in constants for testnet/mainnet.
 */
export type MessagingGroupsPackageConfig = {
	/** The messaging package ID */
	packageId: string;
	/** The MessagingNamespace shared object ID */
	namespaceId: string;
};

/**
 * A client that has been extended with the PermissionedGroupsClient and SealClient.
 * The messaging client requires both extensions to be present.
 */
export interface MessagingGroupsCompatibleClient extends ClientWithCoreApi {
	/** The permissioned-groups extension (required) */
	groups: PermissionedGroupsClient;
	/** The Seal extension (required for encryption) */
	seal: SealClient;
}

/** Encryption-specific options for the messaging groups client. */
export interface MessagingGroupsEncryptionOptions {
	/** Custom crypto primitives (default: Web Crypto). */
	cryptoPrimitives?: CryptoPrimitives;
	/** Default Seal threshold (default: 2). */
	defaultThreshold?: number;
}

export interface MessagingGroupsClientOptions {
	client: MessagingGroupsCompatibleClient;
	/**
	 * Custom package configuration for localnet, devnet, or custom deployments.
	 * When not provided, the config is auto-detected from the client's network.
	 */
	packageConfig?: MessagingGroupsPackageConfig;
	/** Encryption configuration. */
	encryption?: MessagingGroupsEncryptionOptions;
}

// === Call/Tx Options (no signer) ===

/** Options for creating a new messaging group. */
export interface CreateGroupCallOptions {
	/**
	 * UUID for deterministic address derivation of the group and encryption history.
	 * Generated internally if omitted.
	 */
	uuid?: string;
	/**
	 * Addresses to grant MessagingReader permission on creation.
	 * The creator is automatically granted all permissions and should not be included.
	 */
	initialMembers?: string[];
}

/**
 * Options for rotating the encryption key.
 * The new DEK is generated and Seal-encrypted internally.
 *
 * Accepts either explicit `groupId` + `encryptionHistoryId`, or a `uuid`
 * (which derives both IDs internally).
 */
export type RotateEncryptionKeyCallOptions = GroupRef;

/**
 * Options for removing a member from an encrypted messaging group.
 *
 * This is a composite operation that:
 * 1. Removes the member from the PermissionedGroup (revoking all permissions)
 * 2. Automatically rotates the encryption key
 *
 * The key rotation ensures the removed member cannot decrypt messages sent after removal.
 * Messages encrypted with previous key versions remain accessible to anyone who previously
 * held the DEK (this is inherent — the removed member may have cached it locally).
 *
 * For manual control over these steps, use `client.groups.removeMember()` and
 * `client.messaging.call.rotateEncryptionKey()` separately.
 *
 * Accepts either explicit `groupId` + `encryptionHistoryId`, or a `uuid`
 * (which derives both IDs internally).
 */
export type RemoveMemberCallOptions = GroupRef & {
	/** Address of the member to remove. */
	member: string;
};

/** Options for granting all messaging permissions to a member */
export interface GrantAllMessagingPermissionsCallOptions {
	/** Object ID or TransactionArgument for the PermissionedGroup<Messaging> */
	groupId: string | TransactionArgument;
	/** Address of the member to grant permissions to */
	member: string | TransactionArgument;
}

/** Options for granting all permissions (admin + messaging) to a member */
export interface GrantAllPermissionsCallOptions {
	/** Object ID or TransactionArgument for the PermissionedGroup<Messaging> */
	groupId: string | TransactionArgument;
	/** Address of the member to grant permissions to */
	member: string | TransactionArgument;
}

// === Top-level Imperative Options (add signer) ===

/** Options for creating a group (imperative) */
export interface CreateGroupOptions extends CreateGroupCallOptions {
	/** Signer to execute the transaction */
	signer: Signer;
}

/** Options for rotating encryption key (imperative) */
export type RotateEncryptionKeyOptions = RotateEncryptionKeyCallOptions & {
	/** Signer to execute the transaction */
	signer: Signer;
};

/** Options for granting all messaging permissions (imperative) */
export interface GrantAllMessagingPermissionsOptions extends GrantAllMessagingPermissionsCallOptions {
	/** Signer to execute the transaction */
	signer: Signer;
}

/** Options for granting all permissions (imperative) */
export interface GrantAllPermissionsOptions extends GrantAllPermissionsCallOptions {
	/** Signer to execute the transaction */
	signer: Signer;
}

/** Options for removing a member (imperative) */
export type RemoveMemberOptions = RemoveMemberCallOptions & {
	/** Signer to execute the transaction */
	signer: Signer;
};

// === Shared Reference Types ===

/**
 * Reference to an EncryptionHistory — by object ID or by UUID (which derives the ID).
 * Exactly one must be provided.
 */
export type EncryptionHistoryRef =
	| { encryptionHistoryId: string; uuid?: never }
	| { uuid: string; encryptionHistoryId?: never };

/**
 * Reference to a group + encryption history pair — by explicit IDs or by UUID.
 *
 * Since both the `PermissionedGroup<Messaging>` and `EncryptionHistory` are derived
 * from the same UUID, providing a UUID derives both IDs internally.
 */
export type GroupRef =
	| { groupId: string; encryptionHistoryId: string; uuid?: never }
	| { uuid: string; groupId?: never; encryptionHistoryId?: never };

// === View Options ===

/** Options for getting the encrypted key at a specific version */
export type EncryptedKeyViewOptions = EncryptionHistoryRef & {
	/** Key version (0-indexed) */
	version: bigint | number;
};
