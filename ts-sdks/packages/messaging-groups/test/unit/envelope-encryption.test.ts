// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SessionKey } from '@mysten/seal';
import type { SealCompatibleClient } from '@mysten/seal';
import { ClientCache, type ClientWithCoreApi } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { describe, expect, it } from 'vitest';

import type { MessagingGroupsView } from '../../src/view.js';
import { MessagingGroupsDerive } from '../../src/derive.js';
import { EnvelopeEncryption } from '../../src/encryption/envelope-encryption.js';
import { NONCE_LENGTH } from '../../src/encryption/dek-manager.js';
import { createMockSealClient } from './helpers/mock-seal-client.js';

const MOCK_PACKAGE_ID = '0x' + 'ab'.repeat(32);
const MOCK_NAMESPACE_ID = '0x' + '99'.repeat(32);

const mockSealSuiClient = {} as SealCompatibleClient;

function createTestSessionKey(): SessionKey {
	const keypair = Ed25519Keypair.generate();
	return SessionKey.import(
		{
			address: keypair.getPublicKey().toSuiAddress(),
			packageId: '0x' + '00'.repeat(32),
			creationTimeMs: Date.now(),
			ttlMin: 30,
			sessionKey: keypair.getSecretKey(),
		},
		mockSealSuiClient,
	);
}

function createMockSuiClient(): ClientWithCoreApi {
	return {
		cache: new ClientCache(),
	} as unknown as ClientWithCoreApi;
}

function createMockView(currentKeyVersion = 0n): MessagingGroupsView {
	return {
		getCurrentKeyVersion: async () => currentKeyVersion,
	} as unknown as MessagingGroupsView;
}

function createMockDerive(): MessagingGroupsDerive {
	return new MessagingGroupsDerive({
		packageConfig: { packageId: MOCK_PACKAGE_ID, namespaceId: MOCK_NAMESPACE_ID },
	});
}

function createEnvelopeEncryption(currentKeyVersion = 0n) {
	const derive = createMockDerive();
	return new EnvelopeEncryption({
		sealClient: createMockSealClient(),
		suiClient: createMockSuiClient(),
		view: createMockView(currentKeyVersion),
		derive,
		packageId: MOCK_PACKAGE_ID,
	});
}

describe('EnvelopeEncryption', () => {
	describe('generateGroupDEK', () => {
		it('should generate a UUID and encrypted DEK', async () => {
			const ee = createEnvelopeEncryption();

			const result = await ee.generateGroupDEK();

			expect(result.uuid).toBeDefined();
			expect(typeof result.uuid).toBe('string');
			expect(result.encryptedDek.length).toBeGreaterThan(0);
		});

		it('should use a provided UUID', async () => {
			const ee = createEnvelopeEncryption();
			const uuid = 'my-custom-uuid';

			const result = await ee.generateGroupDEK(uuid);

			expect(result.uuid).toBe(uuid);
			expect(result.encryptedDek.length).toBeGreaterThan(0);
		});
	});

	describe('generateRotationDEK', () => {
		it('should generate a rotation DEK for the next version', async () => {
			const ee = createEnvelopeEncryption(2n);
			const derive = createMockDerive();
			const uuid = 'rotation-test-uuid';
			const groupId = derive.groupId({ uuid });
			const encryptionHistoryId = derive.encryptionHistoryId({ uuid });

			const result = await ee.generateRotationDEK({ groupId, encryptionHistoryId });

			expect(result.encryptedDek.length).toBeGreaterThan(0);
			expect(result.groupId).toBe(groupId);
			expect(result.encryptionHistoryId).toBe(encryptionHistoryId);
		});

		it('should derive IDs from UUID', async () => {
			const ee = createEnvelopeEncryption(0n);
			const derive = createMockDerive();
			const uuid = 'derive-test-uuid';

			const result = await ee.generateRotationDEK({ uuid });

			expect(result.groupId).toBe(derive.groupId({ uuid }));
			expect(result.encryptionHistoryId).toBe(derive.encryptionHistoryId({ uuid }));
		});
	});

	describe('encrypt / decrypt roundtrip', () => {
		it('should roundtrip encrypt and decrypt data', async () => {
			const ee = createEnvelopeEncryption();
			const sessionKey = createTestSessionKey();
			const plaintext = new TextEncoder().encode('hello world');

			// Generate group DEK — this warms the cache at version 0
			const { uuid } = await ee.generateGroupDEK();
			const derive = createMockDerive();
			const groupId = derive.groupId({ uuid });
			const encryptionHistoryId = derive.encryptionHistoryId({ uuid });

			const envelope = await ee.encrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				data: plaintext,
			});

			expect(envelope.ciphertext.length).toBeGreaterThan(plaintext.length);
			expect(envelope.nonce.length).toBe(NONCE_LENGTH);
			expect(envelope.keyVersion).toBe(0n);

			const decrypted = await ee.decrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				envelope,
			});

			expect(new TextDecoder().decode(decrypted)).toBe('hello world');
		});

		it('should roundtrip with additional authenticated data', async () => {
			const ee = createEnvelopeEncryption();
			const sessionKey = createTestSessionKey();
			const plaintext = new TextEncoder().encode('secret message');
			const aad = new TextEncoder().encode('metadata');

			const { uuid } = await ee.generateGroupDEK();
			const derive = createMockDerive();
			const groupId = derive.groupId({ uuid });
			const encryptionHistoryId = derive.encryptionHistoryId({ uuid });

			const envelope = await ee.encrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				data: plaintext,
				aad,
			});

			expect(envelope.aad).toEqual(aad);

			const decrypted = await ee.decrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				envelope,
			});

			expect(new TextDecoder().decode(decrypted)).toBe('secret message');
		});

		it('should fail decryption with wrong AAD', async () => {
			const ee = createEnvelopeEncryption();
			const sessionKey = createTestSessionKey();
			const plaintext = new TextEncoder().encode('secret');

			const { uuid } = await ee.generateGroupDEK();
			const derive = createMockDerive();
			const groupId = derive.groupId({ uuid });
			const encryptionHistoryId = derive.encryptionHistoryId({ uuid });

			const envelope = await ee.encrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				data: plaintext,
				aad: new TextEncoder().encode('correct aad'),
			});

			// Tamper with AAD
			envelope.aad = new TextEncoder().encode('wrong aad');

			await expect(
				ee.decrypt({
					groupId,
					encryptionHistoryId,
					keyVersion: 0n,
					sessionKey,
					envelope,
				}),
			).rejects.toThrow();
		});
	});

	describe('cache management', () => {
		it('should use cached DEK for subsequent encryptions', async () => {
			const ee = createEnvelopeEncryption();
			const sessionKey = createTestSessionKey();
			const data1 = new TextEncoder().encode('message 1');
			const data2 = new TextEncoder().encode('message 2');

			const { uuid } = await ee.generateGroupDEK();
			const derive = createMockDerive();
			const groupId = derive.groupId({ uuid });
			const encryptionHistoryId = derive.encryptionHistoryId({ uuid });

			const env1 = await ee.encrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				data: data1,
			});

			const env2 = await ee.encrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				data: data2,
			});

			// Both should decrypt correctly (same DEK)
			const dec1 = await ee.decrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				envelope: env1,
			});
			const dec2 = await ee.decrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				envelope: env2,
			});

			expect(new TextDecoder().decode(dec1)).toBe('message 1');
			expect(new TextDecoder().decode(dec2)).toBe('message 2');
		});

		it('should support different key versions for the same group', async () => {
			// Mock view returns version 0 for the first rotation call
			const ee = createEnvelopeEncryption(0n);
			const sessionKey = createTestSessionKey();
			const data = new TextEncoder().encode('test data');

			// Generate initial DEK (version 0) via group creation
			const { uuid } = await ee.generateGroupDEK();
			const derive = createMockDerive();
			const groupId = derive.groupId({ uuid });
			const encryptionHistoryId = derive.encryptionHistoryId({ uuid });

			// Generate rotation DEK (version 1) — mock view says current is 0, so next is 1
			await ee.generateRotationDEK({ groupId, encryptionHistoryId });

			// Encrypt with version 0
			const env0 = await ee.encrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				data,
			});

			// Encrypt with version 1
			const env1 = await ee.encrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 1n,
				sessionKey,
				data,
			});

			// Both should decrypt correctly with their respective versions
			const dec0 = await ee.decrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 0n,
				sessionKey,
				envelope: env0,
			});
			const dec1 = await ee.decrypt({
				groupId,
				encryptionHistoryId,
				keyVersion: 1n,
				sessionKey,
				envelope: env1,
			});

			expect(new TextDecoder().decode(dec0)).toBe('test data');
			expect(new TextDecoder().decode(dec1)).toBe('test data');

			// Ciphertexts should differ (different DEKs and nonces)
			expect(Array.from(env0.ciphertext)).not.toEqual(Array.from(env1.ciphertext));
		});
	});
});
