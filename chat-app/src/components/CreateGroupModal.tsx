import {type SyntheticEvent, useState} from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useRequiredMessagingClient } from '../contexts/MessagingClientContext';
import { addStoredGroup } from '../lib/group-store';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated: (uuid: string) => void;
}

export function CreateGroupModal({
  open,
  onClose,
  onGroupCreated,
}: Readonly<CreateGroupModalProps>) {
  const { client } = useRequiredMessagingClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Group name is required.');
      return;
    }

    setLoading(true);

    try {
      const uuid = crypto.randomUUID();

      const initialMembers = members
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const tx = client.messaging.tx.createAndShareGroup({
        uuid,
        name: trimmedName,
        ...(initialMembers.length > 0 && { initialMembers }),
      });

      await signAndExecute({ transaction: tx });

      const groupId = client.messaging.derive.groupId({ uuid });

      addStoredGroup({
        uuid,
        name: trimmedName,
        groupId,
        createdAt: Date.now(),
      });

      setName('');
      setMembers('');
      onGroupCreated(uuid);
      onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-surface-container rounded-2xl p-6 shadow-[0_20px_40px_rgba(211,251,255,0.06)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 droplet-gradient rounded-xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-fixed text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              group_add
            </span>
          </div>
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Create Group
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group name */}
          <div>
            <label
              htmlFor="group-name"
              className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Group Name <span className="text-error normal-case tracking-normal">*</span>
            </label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Alpha"
              disabled={loading}
              className="w-full rounded-xl bg-surface-container-low border-none px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
            />
          </div>

          {/* Initial members */}
          <div>
            <label
              htmlFor="initial-members"
              className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Initial Members{' '}
              <span className="normal-case tracking-normal font-normal text-on-surface-variant/50">
                (optional)
              </span>
            </label>
            <textarea
              id="initial-members"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              placeholder="Comma-separated Sui addresses&#10;0xabc..., 0xdef..."
              rows={3}
              disabled={loading}
              className="w-full rounded-xl bg-surface-container-low border-none px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full px-5 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full droplet-gradient px-5 py-2 text-sm font-bold text-on-primary-fixed disabled:opacity-50 transition-transform active:scale-95 shadow-lg"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
