// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type {
	DeleteMessageParams,
	FetchMessageParams,
	FetchMessagesParams,
	FetchMessagesResult,
	RelayerMessage,
	SendMessageParams,
	SendMessageResult,
	SubscribeParams,
	UpdateMessageParams,
} from './types.js';

/**
 * Protocol-agnostic interface for communicating with the off-chain relayer.
 * @example
 * ```ts
 * const transport = new HTTPRelayerTransport({
 *   relayerUrl: 'https://relayer.example.com',
 *   signer: keypair,
 * });
 *
 * // Send a message
 * const { messageId } = await transport.sendMessage({
 *   groupId: '0x...',
 *   encryptedText: envelope.ciphertext,
 *   nonce: envelope.nonce,
 *   keyVersion: envelope.keyVersion,
 * });
 *
 * // Subscribe to new messages
 * const controller = new AbortController();
 * for await (const message of transport.subscribe({
 *   groupId: '0x...',
 *   signal: controller.signal,
 * })) {
 *   console.log('New message:', message.messageId);
 * }
 * ```
 */
export interface RelayerTransport {
	/**
	 * Send a new encrypted message to a group.
	 * @throws {RelayerTransportError} on auth failure (401/403)
	 */
	sendMessage(params: SendMessageParams): Promise<SendMessageResult>;

	/**
	 * Fetch a paginated list of messages for a group.
	 * Supports cursor-based pagination via afterOrder/beforeOrder.
	 * @throws {RelayerTransportError} on auth failure (401/403)
	 */
	fetchMessages(params: FetchMessagesParams): Promise<FetchMessagesResult>;

	/**
	 * Fetch a single message by its relayer-assigned ID.
	 * @throws {RelayerTransportError} with status 404 if message not found
	 * @throws {RelayerTransportError} on auth failure (401/403)
	 */
	fetchMessage(params: FetchMessageParams): Promise<RelayerMessage>;

	/**
	 * Update an existing message with new encrypted content.
	 * Only the original sender can update their own messages.
	 * @throws {RelayerTransportError} with status 403 if not the original sender
	 * @throws {RelayerTransportError} with status 404 if message not found
	 */
	updateMessage(params: UpdateMessageParams): Promise<void>;

	/**
	 * Soft-delete a message.
	 * Only the original sender can delete their own messages. The message is
	 * not removed from storage, its sync_status transitions to DELETE_PENDING.
	 * @throws {RelayerTransportError} with status 403 if not the original sender
	 * @throws {RelayerTransportError} with status 404 if message not found
	 */
	deleteMessage(params: DeleteMessageParams): Promise<void>;

	/**
	 * Subscribe to real-time messages for a group.
	 * Returns an AsyncIterable that yields messages as they arrive.
	 * The iterable completes when the AbortSignal is triggered or
	 * the transport is disconnected.
	 *
	 * Transport implementations differ:
	 * - HTTP: internal polling loop with configurable interval
	 * - SSE: native EventSource connection
	 * - WebSocket: native WebSocket message stream
	 *
	 * Use afterOrder for resumability — when reconnecting, pass the
	 * order of the last received message to avoid gaps.
	 */
	subscribe(params: SubscribeParams): AsyncIterable<RelayerMessage>;

	disconnect(): void;
}
