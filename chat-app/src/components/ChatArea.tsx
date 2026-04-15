import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import type { StoredGroup } from '../lib/group-store';
import { removeStoredGroup } from '../lib/group-store';
import { useRequiredMessagingClient } from '../contexts/MessagingClientContext';
import { useMessages } from '../hooks/useMessages';
import { usePermissions } from '../hooks/usePermissions';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { AdminPanel } from './AdminPanel';

interface ChatAreaProps {
  selectedGroup: StoredGroup | null;
  onLeaveGroup?: () => void;
}

/** Wrapper that requires a UUID to render the chat. */
export function ChatArea({ selectedGroup, onLeaveGroup }: Readonly<ChatAreaProps>) {
  if (!selectedGroup) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-surface-container-high rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-on-surface-variant text-2xl">
              forum
            </span>
          </div>
          <p className="text-on-surface-variant text-sm">
            Select a group to start chatting
          </p>
        </div>
      </div>
    );
  }

  // Groups discovered via events may not have a UUID
  if (!selectedGroup.uuid) {
    return (
      <div className="flex flex-1 flex-col bg-surface">
        <ChatHeader name={selectedGroup.name} />
        <div className="flex flex-1 items-center justify-center px-8 text-center">
          <p className="text-sm text-on-surface-variant">
            This group was discovered via on-chain events.
            <br />
            Chatting requires the group UUID — try joining via an invite link.
          </p>
        </div>
      </div>
    );
  }

  return <ChatView group={selectedGroup} onLeaveGroup={onLeaveGroup} />;
}

function ChatHeader({
  name,
  onLeaveClick,
  leaving,
  onToggleAdmin,
  adminPanelOpen,
}: Readonly<{
  name: string;
  onLeaveClick?: () => void;
  leaving?: boolean;
  onToggleAdmin?: () => void;
  adminPanelOpen?: boolean;
}>) {
  return (
    <div className="flex items-center justify-between bg-surface-container px-6 py-4">
      <h3 className="font-headline font-bold text-on-surface truncate">
        {name}
      </h3>
      <div className="flex items-center gap-1 shrink-0">
        {onLeaveClick && (
          <button
            onClick={onLeaveClick}
            disabled={leaving}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-error hover:bg-error-container/20 disabled:opacity-50 transition-colors"
          >
            {leaving ? 'Leaving...' : 'Leave'}
          </button>
        )}
        {onToggleAdmin && (
          <button
            onClick={onToggleAdmin}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              adminPanelOpen
                ? 'bg-primary/20 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-sm align-middle mr-1" style={adminPanelOpen ? { fontVariationSettings: "'FILL' 1" } : {}}>
              info
            </span>
            Info
          </button>
        )}
      </div>
    </div>
  );
}

/** Inner component that renders when we have a valid UUID. */
function ChatView({
  group,
  onLeaveGroup,
}: Readonly<{
  group: StoredGroup;
  onLeaveGroup?: () => void;
}>) {
  const account = useCurrentAccount();
  const { client } = useRequiredMessagingClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { permissions, refresh: refreshPermissions } = usePermissions(group.groupId);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const {
    messages,
    loading,
    sending,
    error,
    hasMore,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMore,
  } = useMessages(group.uuid);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const handleLeave = useCallback(async () => {
    setLeaving(true);
    setLeaveError(null);

    try {
      const tx = client.messaging.tx.leave({
        groupId: group.groupId,
      });

      await signAndExecute({ transaction: tx });

      removeStoredGroup(group.uuid);
      setShowLeaveConfirm(false);
      onLeaveGroup?.();
    } catch (err) {
      console.error('Failed to leave group:', err);
      setLeaveError(
        err instanceof Error ? err.message : 'Failed to leave group.',
      );
    } finally {
      setLeaving(false);
    }
  }, [client, group, signAndExecute, onLeaveGroup]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMessageCountRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 60;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  useEffect(() => {
    if (!loading && messages.length > 0 && prevMessageCountRef.current === 0) {
      bottomRef.current?.scrollIntoView();
    }
    prevMessageCountRef.current = messages.length;
  }, [loading, messages.length]);

  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isAtBottom]);

  const prevScrollHeightRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 10 && prevScrollHeightRef.current > 0) {
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      if (diff > 0) {
        el.scrollTop = diff;
      }
    }
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col bg-surface overflow-hidden">
        <ChatHeader
          name={group.name}
          onLeaveClick={() => setShowLeaveConfirm(true)}
          leaving={leaving}
          onToggleAdmin={() => setAdminPanelOpen((o) => !o)}
          adminPanelOpen={adminPanelOpen}
        />

        {/* Messages area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex flex-1 flex-col overflow-y-auto scroll-smooth"
        >
          {/* Load more */}
          {hasMore && !loading && (
            <div className="py-3 text-center">
              <button
                onClick={loadMore}
                className="text-xs text-primary hover:text-primary-container transition-colors"
              >
                Load older messages
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs text-on-surface-variant">
                  Loading messages...
                </span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && messages.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-on-surface-variant">
                No messages yet. Send the first one!
              </p>
            </div>
          )}

          {/* Message list */}
          {!loading && messages.length > 0 && (
            <div className="flex flex-col gap-0.5 py-6">
              {messages.map((msg) => {
                const isOwn = msg.senderAddress === account?.address;
                return (
                  <MessageBubble
                    key={msg.messageId}
                    message={msg}
                    isOwnMessage={isOwn}
                    onEdit={isOwn && permissions.canEdit ? editMessage : undefined}
                    onDelete={isOwn && permissions.canDelete ? deleteMessage : undefined}
                  />
                );
              })}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Scroll to bottom FAB */}
        {!isAtBottom && messages.length > 0 && (
          <div className="relative">
            <button
              onClick={scrollToBottom}
              className="absolute -top-14 right-6 z-10 w-10 h-10 rounded-full droplet-gradient flex items-center justify-center text-on-primary-fixed shadow-lg transition-transform active:scale-95"
              aria-label="Scroll to bottom"
            >
              <span className="material-symbols-outlined text-sm">arrow_downward</span>
            </button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="border-t border-error/20 bg-error-container/20 px-4 py-2 text-sm text-error">
            {error}
          </div>
        )}

        {/* Message input */}
        {permissions.canSend ? (
          <MessageInput
            onSend={(text, files) => sendMessage(text, files)}
            sending={sending}
          />
        ) : (
          <div className="border-t border-outline-variant/10 bg-surface-container-low px-4 py-3 text-center text-xs text-on-surface-variant">
            You don't have permission to send messages in this group.
          </div>
        )}

        {/* Leave group confirmation dialog */}
        {showLeaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-sm bg-surface-container rounded-2xl p-6 shadow-[0_20px_40px_rgba(211,251,255,0.06)]">
              <h3 className="mb-2 font-headline text-base font-semibold text-on-surface">
                Leave Group
              </h3>
              <p className="mb-4 text-sm text-on-surface-variant">
                Are you sure you want to leave{' '}
                <span className="font-medium text-on-surface">{group.name}</span>? You will no
                longer receive messages from this group.
              </p>

              {leaveError && (
                <p className="mb-3 text-sm text-error">{leaveError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveConfirm(false);
                    setLeaveError(null);
                  }}
                  disabled={leaving}
                  className="rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={leaving}
                  className="rounded-full bg-error/20 border border-error/30 px-4 py-2 text-sm font-medium text-error hover:bg-error/30 disabled:opacity-50 transition-colors"
                >
                  {leaving ? 'Leaving...' : 'Leave'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin / Group Info panel */}
      <AdminPanel
        open={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
        groupId={group.groupId}
        groupUuid={group.uuid}
        groupName={group.name}
        permissions={permissions}
        onPermissionsChanged={refreshPermissions}
      />
    </div>
  );
}
