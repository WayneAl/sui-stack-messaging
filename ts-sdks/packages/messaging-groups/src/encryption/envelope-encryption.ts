// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { SealClient, SessionKey } from '@mysten/seal';
import { EncryptedObject } from '@mysten/seal';
import type { ClientCache, ClientWithCoreApi } from '@mysten/sui/client';
import { Transaction, type TransactionResult } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';

import type { MessagingGroupsDerive } from '../derive.js';
import type { GroupRef, MessagingGroupsEncryptionOptions } from '../types.js';
import type { MessagingGroupsView } from '../view.js';
import type { CryptoPrimitives } from './crypto-primitives.js';
import { getDefaultCryptoPrimitives } from './crypto-primitives.js';
import { DEKManager, NONCE_LENGTH, type GeneratedDEK } from './dek-manager.js';
import { SessionKeyManager } from './session-key-manager.js';

/** The result of encrypting data with envelope encryption. */
export interface EncryptedEnvelope {
	/** AES-256-GCM ciphertext (with 16-byte auth tag appended). */
	ciphertext: Uint8Array;
	/** 12-byte nonce used for AES-GCM. */
	nonce: Uint8Array;
	/** Key version used for encryption. */
	keyVersion: bigint;
	/** Optional additional authenticated data. */
	aad?: Uint8Array;
}

/**
 * Builds a custom `seal_approve` transaction thunk from the Seal identity bytes.
 *
 * Use this when your package implements a custom `seal_approve` function
 * (e.g. subscription-based, NFT-gated access). The returned thunk is
 * compatible with `tx.add()`.
 *
 * @example
 * ```ts
 * const customApprove: SealApproveBuilder = (identityBytes) => (tx) =>
 *   tx.moveCall({
 *     target: `${pkg}::my_policies::seal_approve_subscriber`,
 *     arguments: [
 *       tx.pure.vector('u8', Array.from(identityBytes)),
 *       tx.object(subscriptionId),
 *     ],
 *   });
 * ```
 */
export type SealApproveBuilder = (
	identityBytes: Uint8Array,
) => (tx: Transaction) => TransactionResult;

/** Options for encrypt(). */
export type EncryptOptions = GroupRef & {
	data: Uint8Array;
	/** Key version to use. Default: latest from chain. */
	keyVersion?: bigint;
	aad?: Uint8Array;
	sealApproveBuilder?: SealApproveBuilder;
};

/** Options for decrypt(). */
export type DecryptOptions = GroupRef & {
	envelope: EncryptedEnvelope;
	sealApproveBuilder?: SealApproveBuilder;
};

/** Internal options for DEK resolution (after GroupRef is resolved). */
interface DEKResolutionOptions {
	groupId: string;
	encryptionHistoryId: string;
	keyVersion: bigint;
	sessionKey: SessionKey;
	sealApproveBuilder?: SealApproveBuilder;
}

export interface EnvelopeEncryptionConfig {
	/** Seal client for threshold encryption of DEKs. */
	sealClient: SealClient;
	/** Sui client for building seal_approve transactions. */
	suiClient: ClientWithCoreApi;
	/** View layer for fetching encrypted keys from EncryptionHistory. */
	view: MessagingGroupsView;
	/** Derive layer for deterministic ID derivation. */
	derive: MessagingGroupsDerive;
	/** Move package ID for the messaging module. */
	packageId: string;
	/** Encryption options (session key config, crypto, threshold). */
	encryption: MessagingGroupsEncryptionOptions;
}

/**
 * Top-level envelope encryption orchestrator.
 *
 * Coordinates the full E2EE lifecycle:
 * - **Encrypt:** resolve DEK (fetch + Seal-decrypt, with cache) → AES-GCM encrypt data
 * - **Decrypt:** resolve DEK (from cache or fetch + Seal-decrypt) → AES-GCM decrypt data
 * - **Generate DEK:** for group creation / key rotation (separate from encrypt/decrypt)
 *
 * Session keys are managed internally via {@link SessionKeyManager} — consumers
 * never pass session keys to individual operations.
 *
 * Decrypted DEKs are cached via {@link ClientCache} (scoped under `dek`)
 * so repeated operations for the same group/version don't re-invoke Seal.
 */
export class EnvelopeEncryption {
	readonly #dekManager: DEKManager;
	readonly #crypto: CryptoPrimitives;
	readonly #packageId: string;
	readonly #suiClient: ClientWithCoreApi;
	readonly #view: MessagingGroupsView;
	readonly #derive: MessagingGroupsDerive;
	readonly #dekCache: ClientCache;
	readonly #sessionKeyManager: SessionKeyManager;

	constructor(config: EnvelopeEncryptionConfig) {
		this.#suiClient = config.suiClient;
		this.#view = config.view;
		this.#derive = config.derive;
		this.#packageId = config.packageId;
		this.#crypto = config.encryption.cryptoPrimitives ?? getDefaultCryptoPrimitives();
		this.#dekCache = config.suiClient.cache.scope('dek');
		this.#dekManager = new DEKManager({
			sealClient: config.sealClient,
			packageId: config.packageId,
			cryptoPrimitives: config.encryption.cryptoPrimitives,
			defaultThreshold: config.encryption.sealThreshold,
		});
		this.#sessionKeyManager = new SessionKeyManager({
			sessionKeyConfig: config.encryption.sessionKey,
			packageId: config.packageId,
			suiClient: config.suiClient,
		});
	}

	// === High-Level API ===

	/**
	 * Generate a UUID (if not provided), derive the group ID, and generate
	 * a Seal-encrypted DEK for the group's initial encryption key (version 0).
	 *
	 * Used by `createGroup` / `createAndShareGroup`.
	 */
	async generateGroupDEK(providedUuid?: string): Promise<{
		uuid: string;
		encryptedDek: Uint8Array;
	}> {
		const uuid = providedUuid ?? this.#crypto.generateUUID();
		const groupId = this.#derive.groupId({ uuid });
		const { encryptedDek } = await this.#generateDEK({ groupId });
		return { uuid, encryptedDek };
	}

	/**
	 * Fetch the current key version, generate a new DEK for the next version,
	 * and Seal-encrypt it.
	 *
	 * Used by `rotateEncryptionKey` and `removeMember`.
	 *
	 * Accepts either explicit `groupId` + `encryptionHistoryId`, or a `uuid`
	 * (which derives both IDs internally).
	 */
	async generateRotationDEK(
		options: GroupRef,
	): Promise<GeneratedDEK & { groupId: string; encryptionHistoryId: string }> {
		const { groupId, encryptionHistoryId } = this.#resolveGroupRef(options);

		const currentVersion = await this.#view.getCurrentKeyVersion({ encryptionHistoryId });
		const result = await this.#generateDEK({
			groupId,
			keyVersion: currentVersion + 1n,
		});
		return { ...result, groupId, encryptionHistoryId };
	}

	/**
	 * Encrypt data for a group.
	 *
	 * Resolves the group's DEK (fetching from EncryptionHistory and
	 * Seal-decrypting if not cached) and AES-GCM encrypts the data.
	 *
	 * Session key is resolved internally — never needs to be passed.
	 * Key version defaults to the latest from chain if not specified.
	 */
	async encrypt(options: EncryptOptions): Promise<EncryptedEnvelope> {
		const { groupId, encryptionHistoryId } = this.#resolveGroupRef(options);
		const sessionKey = await this.#sessionKeyManager.getSessionKey();

		const keyVersion =
			options.keyVersion ?? (await this.#view.getCurrentKeyVersion({ encryptionHistoryId }));

		const dek = await this.#resolveDEK({
			groupId,
			encryptionHistoryId,
			keyVersion,
			sessionKey,
			sealApproveBuilder: options.sealApproveBuilder,
		});

		const nonce = this.#crypto.generateRandomBytes(NONCE_LENGTH);
		const ciphertext = await this.#crypto.aesGcmEncrypt(dek, options.data, nonce, options.aad);

		return {
			ciphertext,
			nonce,
			keyVersion,
			aad: options.aad,
		};
	}

	/**
	 * Decrypt data for a group.
	 *
	 * Resolves the group's DEK (from cache or fetch + Seal-decrypt)
	 * and AES-GCM decrypts the envelope.
	 *
	 * Session key is resolved internally. Key version comes from the envelope.
	 */
	async decrypt(options: DecryptOptions): Promise<Uint8Array> {
		const { groupId, encryptionHistoryId } = this.#resolveGroupRef(options);
		const sessionKey = await this.#sessionKeyManager.getSessionKey();

		const dek = await this.#resolveDEK({
			groupId,
			encryptionHistoryId,
			keyVersion: options.envelope.keyVersion,
			sessionKey,
			sealApproveBuilder: options.sealApproveBuilder,
		});

		return this.#crypto.aesGcmDecrypt(
			dek,
			options.envelope.ciphertext,
			options.envelope.nonce,
			options.envelope.aad,
		);
	}

	// === Cache Management ===

	/** Clear cached DEKs — all, or only those for a specific group. */
	clearCache(groupId?: string): void {
		this.#dekCache.clear(groupId ? [groupId] : undefined);
	}

	// === Private: GroupRef Resolution ===

	#resolveGroupRef(ref: GroupRef): { groupId: string; encryptionHistoryId: string } {
		if ('uuid' in ref && ref.uuid) {
			return {
				groupId: this.#derive.groupId({ uuid: ref.uuid }),
				encryptionHistoryId: this.#derive.encryptionHistoryId({ uuid: ref.uuid }),
			};
		}
		return {
			groupId: ref.groupId!,
			encryptionHistoryId: ref.encryptionHistoryId!,
		};
	}

	// === Private: DEK Generation ===

	/**
	 * Generate a new DEK and Seal-encrypt it. Warms the DEK cache.
	 */
	async #generateDEK(options: {
		groupId: string;
		keyVersion?: bigint;
		threshold?: number;
	}): Promise<GeneratedDEK> {
		const result = await this.#dekManager.generateDEK(options);

		// Warm the cache so subsequent encrypt/decrypt calls skip Seal.
		this.#putDEK(options.groupId, result.identity.keyVersion, result.dek);

		return result;
	}

	// === Private: DEK Resolution ===

	async #resolveDEK(options: DEKResolutionOptions): Promise<Uint8Array> {
		return this.#dekCache.read(
			[options.groupId, options.keyVersion.toString()],
			async () => {
				const encryptedDek = await this.#view.encryptedKey({
					encryptionHistoryId: options.encryptionHistoryId,
					version: options.keyVersion,
				});

				const txBytes = await this.#buildSealApproveBytes({
					encryptedDek,
					groupId: options.groupId,
					encryptionHistoryId: options.encryptionHistoryId,
					builder: options.sealApproveBuilder,
				});

				return this.#dekManager.decryptDEK({
					encryptedDek,
					sessionKey: options.sessionKey,
					txBytes,
				});
			},
		);
	}

	#putDEK(groupId: string, keyVersion: bigint, dek: Uint8Array): void {
		this.#dekCache.readSync([groupId, keyVersion.toString()], () => dek);
	}

	// === Private: Seal Transaction Building ===

	async #buildSealApproveBytes(options: {
		encryptedDek: Uint8Array;
		groupId: string;
		encryptionHistoryId: string;
		builder?: SealApproveBuilder;
	}): Promise<Uint8Array> {
		const encryptedObject = EncryptedObject.parse(options.encryptedDek);
		const identityBytes = fromHex(encryptedObject.id);

		const tx = new Transaction();

		if (options.builder) {
			tx.add(options.builder(identityBytes));
		} else {
			tx.moveCall({
				target: `${this.#packageId}::seal_policies::seal_approve_reader`,
				arguments: [
					tx.pure.vector('u8', Array.from(identityBytes)),
					tx.object(options.groupId),
					tx.object(options.encryptionHistoryId),
				],
			});
		}

		return tx.build({ client: this.#suiClient, onlyTransactionKind: true });
	}
}
