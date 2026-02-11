// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { SealClient, SessionKey } from '@mysten/seal';
import { toHex } from '@mysten/sui/utils';

import type { CryptoPrimitives } from './crypto-primitives.js';
import { getDefaultCryptoPrimitives } from './crypto-primitives.js';
import type { SealPolicy } from './seal-policy.js';

/** AES-256 key length in bytes. */
export const DEK_LENGTH = 32;

/** AES-GCM standard nonce length in bytes. */
export const NONCE_LENGTH = 12;

export interface DEKManagerConfig {
	sealClient: SealClient;
	sealPolicy: SealPolicy;
	cryptoPrimitives?: CryptoPrimitives;
	defaultThreshold?: number;
}

/** Result of generating a new DEK. */
export interface GeneratedDEK {
	/** The plaintext 32-byte data encryption key. */
	dek: Uint8Array;
	/** The Seal-encrypted DEK bytes (ready to store on-chain). */
	encryptedDek: Uint8Array;
	/** The identity bytes that were used for Seal encryption. */
	identityBytes: Uint8Array;
}

/**
 * Handles DEK generation and decryption via Seal threshold encryption.
 *
 * Identity bytes and Seal package ID are delegated to the configured
 * {@link SealPolicy}, making the DEK manager policy-agnostic.
 *
 * This is an internal building block — use {@link EnvelopeEncryption} for the
 * top-level API.
 */
export class DEKManager {
	readonly #sealClient: SealClient;
	readonly #sealPolicy: SealPolicy;
	readonly #crypto: CryptoPrimitives;
	readonly #defaultThreshold: number;

	constructor(config: DEKManagerConfig) {
		this.#sealClient = config.sealClient;
		this.#sealPolicy = config.sealPolicy;
		this.#crypto = config.cryptoPrimitives ?? getDefaultCryptoPrimitives();
		this.#defaultThreshold = config.defaultThreshold ?? 2;
	}

	/** Generate an AES-256-GCM DEK and encrypt it with Seal. */
	async generateDEK(options: {
		groupId: string;
		keyVersion?: bigint;
		threshold?: number;
	}): Promise<GeneratedDEK> {
		const keyVersion = options.keyVersion ?? 0n;
		const identityBytes = this.#sealPolicy.buildIdentity(options.groupId, keyVersion);

		const dek = await this.#crypto.generateAesKey();

		const { encryptedObject } = await this.#sealClient.encrypt({
			threshold: options.threshold ?? this.#defaultThreshold,
			packageId: this.#sealPolicy.packageId,
			id: toHex(identityBytes),
			data: dek,
		});

		return { dek, encryptedDek: encryptedObject, identityBytes };
	}

	/** Decrypt a DEK from its Seal-encrypted bytes. */
	async decryptDEK(options: {
		encryptedDek: Uint8Array;
		sessionKey: SessionKey;
		txBytes: Uint8Array;
	}): Promise<Uint8Array> {
		return this.#sealClient.decrypt({
			data: options.encryptedDek,
			sessionKey: options.sessionKey,
			txBytes: options.txBytes,
		});
	}
}
