import { useState, useRef, type KeyboardEvent } from 'react';
import type { AttachmentFile } from '../hooks/useMessages';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 10;

interface MessageInputProps {
  onSend: (text: string, files?: AttachmentFile[]) => Promise<void>;
  disabled?: boolean;
  sending?: boolean;
}

/** Format bytes into a human-readable size string. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInput({
  onSend,
  disabled = false,
  sending = false,
}: Readonly<MessageInputProps>) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || disabled || sending) return;

    let attachmentFiles: AttachmentFile[] | undefined;
    if (files.length > 0) {
      attachmentFiles = await Promise.all(
        files.map(async (f) => ({
          fileName: f.name,
          mimeType: f.type || 'application/octet-stream',
          data: new Uint8Array(await f.arrayBuffer()),
        })),
      );
    }

    setText('');
    setFiles([]);
    setFileError(null);
    await onSend(trimmed, attachmentFiles);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend().then();
    }
  }

  function handleFilesSelected(selectedFiles: FileList | null) {
    if (!selectedFiles) return;
    setFileError(null);

    const incoming = Array.from(selectedFiles);
    const total = files.length + incoming.length;

    if (total > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files per message.`);
      return;
    }

    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`"${f.name}" exceeds the 5 MB limit.`);
        return;
      }
    }

    setFiles((prev) => [...prev, ...incoming]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  }

  const canSend = (text.trim() || files.length > 0) && !disabled && !sending;

  return (
    <div className="bg-surface-container-lowest/50 backdrop-blur-xl border-t border-outline-variant/5 px-6 py-4">
      {/* File chips */}
      {files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface"
            >
              <span className="material-symbols-outlined text-xs text-secondary-container" style={{ fontSize: '14px' }}>
                {f.type.startsWith('image/') ? 'image' : 'description'}
              </span>
              <span className="max-w-[8rem] truncate">{f.name}</span>
              <span className="text-on-surface-variant">{formatSize(f.size)}</span>
              <button
                onClick={() => removeFile(i)}
                className="ml-0.5 text-on-surface-variant hover:text-error transition-colors"
                title="Remove"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File error */}
      {fileError && (
        <p className="mb-2 text-xs text-error">{fileError}</p>
      )}

      {/* Sending indicator */}
      {sending && (
        <div className="mb-2 flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Sending{files.length > 0 ? ' (uploading files...)' : '...'}</span>
        </div>
      )}

      <div className="flex items-end gap-3">
        {/* Input container */}
        <div className="flex-1 bg-surface-container-low rounded-2xl p-2 flex flex-col gap-2 transition-all focus-within:ring-1 focus-within:ring-primary/40 shadow-inner">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an encrypted message..."
            rows={1}
            disabled={disabled || sending}
            className="bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant/50 w-full resize-none py-2 px-3 outline-none disabled:opacity-50"
          />
          <div className="flex items-center px-2 pb-1">
            <div className="flex items-center gap-1">
              {/* Attachment button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || sending}
                className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all rounded-full flex items-center gap-1.5 group disabled:opacity-50"
                title="Attach files via Walrus Storage"
              >
                <span className="material-symbols-outlined text-base">attach_file</span>
                <span className="text-[10px] font-bold hidden md:inline group-hover:text-primary transition-colors">
                  Walrus Storage
                </span>
              </button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-12 h-12 rounded-full droplet-gradient flex items-center justify-center text-on-primary-fixed shadow-lg active:scale-95 transition-transform disabled:opacity-50 shrink-0"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            send
          </span>
        </button>
      </div>
    </div>
  );
}
