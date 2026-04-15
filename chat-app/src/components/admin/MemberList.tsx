import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { MemberItem } from './MemberItem';

interface MemberWithPermissions {
  address: string;
  permissions: string[];
}

interface PermType {
  key: string;
  value: string;
}

interface MemberListProps {
  members: MemberWithPermissions[];
  loading: boolean;
  isAdmin: boolean;
  removingMember: string | null;
  removeError: string | null;
  togglingPerm: string | null;
  messagingPermTypes: PermType[];
  onRemoveMember: (address: string) => void;
  onRemoveAndRotate: (address: string) => void;
  onTogglePermission: (member: string, permType: string, has: boolean) => void;
}

export function MemberList({
  members,
  loading,
  isAdmin,
  removingMember,
  removeError,
  togglingPerm,
  messagingPermTypes,
  onRemoveMember,
  onRemoveAndRotate,
  onTogglePermission,
}: Readonly<MemberListProps>) {
  const account = useCurrentAccount();
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  return (
    <section className="border-b border-outline-variant/10 p-4">
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        Members ({members.length})
      </h4>

      {loading && (
        <div className="flex items-center gap-2 py-4">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs text-on-surface-variant">Loading...</span>
        </div>
      )}

      {!loading && members.length === 0 && (
        <p className="text-xs text-on-surface-variant">No members found.</p>
      )}

      {!loading && members.length > 0 && (
        <ul className="space-y-2">
          {members.map((m) => {
            const isSelf = m.address === account?.address;
            return (
              <MemberItem
                key={m.address}
                address={m.address}
                permissions={m.permissions}
                isSelf={isSelf}
                isAdmin={isAdmin}
                isExpanded={expandedMember === m.address}
                removingMember={removingMember}
                togglingPerm={togglingPerm}
                messagingPermTypes={messagingPermTypes}
                onToggleExpand={() =>
                  setExpandedMember(
                    expandedMember === m.address ? null : m.address,
                  )
                }
                onRemoveMember={onRemoveMember}
                onRemoveAndRotate={onRemoveAndRotate}
                onTogglePermission={onTogglePermission}
              />
            );
          })}
        </ul>
      )}

      {removeError && (
        <p className="mt-2 text-xs text-error">{removeError}</p>
      )}
    </section>
  );
}
