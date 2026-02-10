// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

// Types (re-exports from submodules)
export type {
	CryptoPrimitives,
	SealIdentity,
	GeneratedDEK,
	DEKManagerConfig,
	EnvelopeEncryptionConfig,
	EncryptedEnvelope,
	EncryptOptions,
	DecryptOptions,
	SealApproveBuilder,
} from './types.js';

export { IDENTITY_BYTES_LENGTH, DEK_LENGTH, NONCE_LENGTH } from './types.js';

// Crypto primitives
export { WebCryptoPrimitives, getDefaultCryptoPrimitives } from './crypto-primitives.js';

// DEK Manager
export { DEKManager, encodeIdentity, decodeIdentity } from './dek-manager.js';

// Envelope Encryption
export { EnvelopeEncryption } from './envelope-encryption.js';
