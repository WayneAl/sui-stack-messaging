import { useState } from 'react';

interface GroupActionsSectionProps {
  canRotateKey: boolean;
  actionError: string | null;
  onRotateKey: () => Promise<void>;
  onArchive: () => Promise<void>;
}

export function GroupActionsSection({
  canRotateKey,
  actionError,
  onRotateKey,
  onArchive,
}: Readonly<GroupActionsSectionProps>) {
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    try {
      await onArchive();
      setShowArchiveConfirm(false);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <section className="p-4">
      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        Group Actions
      </h4>

      {canRotateKey && (
        <button
          onClick={onRotateKey}
          className="mb-2 w-full rounded-full border border-outline-variant/20 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-sm align-middle mr-1">key</span>
          Rotate Encryption Key
        </button>
      )}

      {showArchiveConfirm ? (
        <div className="rounded-xl bg-error-container/10 border border-error/20 p-3">
          <p className="mb-3 text-xs text-error/80">
            This action is permanent. The group will be paused and no new
            messages can be sent.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowArchiveConfirm(false)}
              disabled={archiving}
              className="flex-1 rounded-full py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="flex-1 rounded-full bg-error/20 border border-error/30 py-1.5 text-xs font-medium text-error hover:bg-error/30 disabled:opacity-50 transition-colors"
            >
              {archiving ? 'Archiving...' : 'Confirm Archive'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowArchiveConfirm(true)}
          className="w-full rounded-full border border-error/30 py-2 text-xs font-medium text-error hover:bg-error/10 transition-colors"
        >
          <span className="material-symbols-outlined text-sm align-middle mr-1">archive</span>
          Archive Group
        </button>
      )}

      {actionError && (
        <p className="mt-2 text-xs text-error">{actionError}</p>
      )}
    </section>
  );
}
