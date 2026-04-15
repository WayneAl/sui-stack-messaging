interface PermType {
  key: string;
  value: string;
}

interface MemberItemProps {
  address: string;
  permissions: string[];
  isSelf: boolean;
  isAdmin: boolean;
  isExpanded: boolean;
  removingMember: string | null;
  togglingPerm: string | null;
  messagingPermTypes: PermType[];
  onToggleExpand: () => void;
  onRemoveMember: (address: string) => void;
  onRemoveAndRotate: (address: string) => void;
  onTogglePermission: (member: string, permType: string, has: boolean) => void;
}

function permissionLabel(permType: string): string {
  if (permType.includes('MessagingSender')) return 'Send';
  if (permType.includes('MessagingReader')) return 'Read';
  if (permType.includes('MessagingEditor')) return 'Edit';
  if (permType.includes('MessagingDeleter')) return 'Delete';
  if (permType.includes('EncryptionKeyRotator')) return 'Rotate Key';
  if (permType.includes('MetadataAdmin')) return 'Metadata';
  if (permType.includes('PermissionsAdmin')) return 'Admin';
  if (permType.includes('ExtensionPermissionsAdmin')) return 'Ext Admin';
  if (permType.includes('ObjectAdmin')) return 'Obj Admin';
  if (permType.includes('GroupDeleter')) return 'Deleter';
  const parts = permType.split('::');
  return parts.at(-1) || permType;
}

function truncateAddress(address: string): string {
  if (!address) return 'unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function MemberItem({
  address,
  permissions,
  isSelf,
  isAdmin,
  isExpanded,
  removingMember,
  togglingPerm,
  messagingPermTypes,
  onToggleExpand,
  onRemoveMember,
  onRemoveAndRotate,
  onTogglePermission,
}: Readonly<MemberItemProps>) {
  return (
    <li className="rounded-xl bg-surface-container-high border border-outline-variant/10 p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleExpand}
          className="font-mono text-xs text-on-surface hover:text-primary transition-colors flex items-center gap-1"
        >
          {truncateAddress(address)}
          {isSelf && <span className="ml-1 text-secondary-container font-sans font-medium">(you)</span>}
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '14px' }}>
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {isAdmin && !isSelf && (
          <div className="flex gap-1.5">
            <button
              onClick={() => onRemoveAndRotate(address)}
              disabled={removingMember === address}
              className="text-[10px] text-error hover:text-error/80 disabled:opacity-50 transition-colors"
              title="Remove member and rotate encryption key"
            >
              {removingMember === address ? '...' : 'Remove+Key'}
            </button>
            <button
              onClick={() => onRemoveMember(address)}
              disabled={removingMember === address}
              className="text-[10px] text-error/70 hover:text-error disabled:opacity-50 transition-colors"
              title="Remove member (no key rotation)"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Permission badges (collapsed view) */}
      {!isExpanded && (
        <div className="mt-2 flex flex-wrap gap-1">
          {permissions.map((p) => (
            <span
              key={p}
              className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-medium text-on-surface-variant"
            >
              {permissionLabel(p)}
            </span>
          ))}
        </div>
      )}

      {/* Permission toggles (expanded, admin + not self) */}
      {isExpanded && isAdmin && !isSelf && (
        <div className="mt-2 space-y-1.5 border-t border-outline-variant/10 pt-2">
          {messagingPermTypes.map((perm) => {
            const has = permissions.some(
              (p) =>
                p === perm.value ||
                p === perm.value.replace(/^0x/, ''),
            );
            const toggleKey = `${address}:${perm.value}`;
            return (
              <label
                key={perm.key}
                className="flex items-center justify-between text-xs text-on-surface-variant"
              >
                <span>{perm.key}</span>
                <button
                  onClick={() => onTogglePermission(address, perm.value, has)}
                  disabled={togglingPerm === toggleKey}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                    has
                      ? 'bg-secondary-container/20 text-secondary-container'
                      : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  {togglingPerm === toggleKey ? '...' : has ? 'ON' : 'OFF'}
                </button>
              </label>
            );
          })}
        </div>
      )}

      {/* Read-only permissions (expanded, non-admin or self) */}
      {isExpanded && (!isAdmin || isSelf) && (
        <div className="mt-2 space-y-1.5 border-t border-outline-variant/10 pt-2">
          {permissions.map((p) => (
            <div
              key={p}
              className="flex items-center justify-between text-xs text-on-surface-variant"
            >
              <span>{permissionLabel(p)}</span>
              <span className="rounded-full bg-secondary-container/20 px-2.5 py-0.5 text-[10px] font-bold text-secondary-container">
                ON
              </span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
