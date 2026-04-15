import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import type { Message, AttachmentHandle } from '../hooks/useMessages';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  onEdit?: (messageId: string, text: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
}

/** Format Unix timestamp (seconds) to a short relative/absolute time string. */
function formatTime(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateAddress(address: string): string {
  if (!address) return 'unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({
  handle,
}: Readonly<{
  handle: AttachmentHandle;
  isOwnMessage: boolean;
}>) {
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const isImage = handle.mimeType.startsWith('image/');

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError(false);
    try {
      const data = await handle.data();
      const blob = new Blob([new Uint8Array(data)], { type: handle.mimeType });
      const url = URL.createObjectURL(blob);

      if (isImage) {
        setPreviewUrl(url);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = handle.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download attachment:', err);
      setError(true);
    } finally {
      setDownloading(false);
    }
  }, [handle, isImage]);

  return (
    <div className="mt-2">
      {/* Image preview */}
      {previewUrl && isImage && (
        <img
          src={previewUrl}
          alt={handle.fileName}
          className="mb-2 max-h-48 rounded-xl object-contain"
        />
      )}
      {/* File card */}
      <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-xl">
        <div className="w-10 h-10 bg-surface-container-high rounded-xl flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-secondary-container text-base">
            {isImage ? 'image' : 'description'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-on-surface" title={handle.fileName}>
            {handle.fileName}
          </p>
          <p className="text-[10px] text-on-surface-variant">{formatSize(handle.fileSize)}</p>
        </div>

        {error ? (
          <span className="text-xs text-error shrink-0">failed</span>
        ) : (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-primary hover:bg-surface-variant transition-colors disabled:opacity-50 shrink-0"
            title={isImage && !previewUrl ? 'Preview' : 'Download'}
          >
            {downloading ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-sm">
                {isImage && !previewUrl ? 'visibility' : 'download'}
              </span>
            )}
          </button>
        )}
      </div>
      {/* Walrus storage indicator */}
      <div className="mt-2 flex items-center gap-1.5 bg-surface-variant/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-outline-variant/15 w-fit">
        <span className="material-symbols-outlined text-secondary-fixed text-xs" style={{ fontSize: '14px' }}>
          cloud_done
        </span>
        <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
          Stored on Walrus
        </span>
      </div>
    </div>
  );
}

export function MessageBubble({
  message,
  isOwnMessage,
  onEdit,
  onDelete,
}: Readonly<MessageBubbleProps>) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editing, editText.length]);

  if (message.isDeleted) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs italic text-on-surface-variant">
          Message deleted
        </span>
      </div>
    );
  }

  async function handleSaveEdit() {
    if (!onEdit || saving) return;
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.text) {
      setEditing(false);
      setEditText(message.text);
      return;
    }

    setSaving(true);
    try {
      await onEdit(message.messageId, trimmed);
      setEditing(false);
    } catch {
      // Error handled in hook; keep edit mode open
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditText(message.text);
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit().then();
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }

  async function handleDelete() {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(message.messageId);
      setShowDeleteConfirm(false);
    } catch {
      // Error handled in hook
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={`group flex ${isOwnMessage ? 'justify-end' : 'justify-start'} px-6 py-1`}
    >
      <div className="relative max-w-[70%]">
        {/* Action buttons (hover, own messages only) */}
        {isOwnMessage && !editing && (onEdit || onDelete) && (
          <div className="absolute -top-3 right-2 z-10 hidden rounded-lg bg-surface-container-highest border border-outline-variant/20 shadow-sm group-hover:flex">
            {onEdit && (
              <button
                onClick={() => {
                  setEditText(message.text);
                  setEditing(true);
                }}
                className="px-2 py-1 text-xs text-on-surface-variant hover:text-primary transition-colors"
                title="Edit"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-2 py-1 text-xs text-on-surface-variant hover:text-error transition-colors"
                title="Delete"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-3 ${
            isOwnMessage
              ? 'bg-primary-container text-on-primary-container rounded-tl-xl rounded-tr-xl rounded-bl-xl'
              : 'bg-surface-container-highest text-on-surface rounded-tl-xl rounded-tr-xl rounded-br-xl'
          } shadow-sm text-sm leading-relaxed`}
        >
          {/* Sender (other people's messages only) */}
          {!isOwnMessage && message.senderAddress && (
            <p className="mb-1 text-xs font-medium text-on-surface-variant font-headline">
              {truncateAddress(message.senderAddress)}
              {message.senderVerified && (
                <span className="ml-1 text-secondary-container" title="Sender verified">
                  ✓
                </span>
              )}
            </p>
          )}

          {/* Message text or edit form */}
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={2}
                disabled={saving}
                className="w-full resize-none rounded-lg bg-surface-container-low border border-outline-variant/20 px-2 py-1 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
              />
              <div className="flex justify-end gap-1">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="rounded px-2 py-0.5 text-xs text-on-surface-variant hover:text-on-surface disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editText.trim()}
                  className="rounded-full droplet-gradient px-3 py-0.5 text-xs font-medium text-on-primary-fixed disabled:opacity-50"
                >
                  {saving ? '...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.text && (
                <p className="whitespace-pre-wrap wrap-break-word">
                  {message.text}
                </p>
              )}
            </>
          )}

          {/* Attachments */}
          {message.attachments?.length > 0 && (
            <div className="space-y-1 mt-1">
              {message.attachments.map((handle, i) => (
                <AttachmentItem
                  key={`${handle.fileName}-${i}`}
                  handle={handle}
                  isOwnMessage={isOwnMessage}
                />
              ))}
            </div>
          )}

          {/* Footer: time + badges */}
          <div
            className={`mt-2 flex items-center gap-1 text-[10px] ${
              isOwnMessage ? 'text-on-primary-container/60' : 'text-on-surface-variant'
            }`}
          >
            <span>{formatTime(message.createdAt)}</span>
            {message.isEdited && <span className="italic">(edited)</span>}
            {message.senderVerified && isOwnMessage && (
              <span title="Sender verified">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1", fontSize: '12px' }}>
                  done_all
                </span>
              </span>
            )}
            {isOwnMessage && message.syncStatus === 'SYNC_PENDING' && (
              <span title="Sending...">
                <span className="material-symbols-outlined text-xs" style={{ fontSize: '12px' }}>
                  schedule
                </span>
              </span>
            )}
            {isOwnMessage && message.syncStatus === 'SYNCED' && (
              <span title="Delivered">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1", fontSize: '12px' }}>
                  done_all
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Delete confirmation popover */}
        {showDeleteConfirm && (
          <div className="absolute -top-20 right-0 z-20 rounded-xl bg-surface-container border border-outline-variant/20 p-3 shadow-[0_20px_40px_rgba(211,251,255,0.06)]">
            <p className="mb-2 text-xs text-on-surface-variant">
              Delete this message?
            </p>
            <div className="flex justify-end gap-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded px-2 py-0.5 text-xs text-on-surface-variant hover:text-on-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full bg-error/20 border border-error/30 px-3 py-0.5 text-xs font-medium text-error hover:bg-error/30 disabled:opacity-50"
              >
                {deleting ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
