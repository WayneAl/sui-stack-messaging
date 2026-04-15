import type { StoredGroup } from '../lib/group-store';

interface SidebarProps {
  groups: StoredGroup[];
  selectedUuid: string | null;
  onSelectGroup: (uuid: string) => void;
  onCreateGroup: () => void;
  loading?: boolean;
}

export function Sidebar({
  groups,
  selectedUuid,
  onSelectGroup,
  onCreateGroup,
  loading = false,
}: Readonly<SidebarProps>) {
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-surface border-r border-outline-variant/10">
      {/* Logo + New Group button */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg droplet-gradient flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-on-primary-fixed"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              water_drop
            </span>
          </div>
          <div>
            <p className="font-headline font-black text-on-surface leading-tight">Seal ID</p>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">
              Encrypted Groups
            </p>
          </div>
        </div>

        <button
          onClick={onCreateGroup}
          className="w-full py-2.5 px-4 droplet-gradient rounded-full text-on-primary-fixed font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg"
        >
          <span className="material-symbols-outlined text-sm">edit_square</span>
          <span className="font-headline tracking-tight text-sm">New Group</span>
        </button>
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* Section header */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Groups
          </span>
          {loading && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-on-surface-variant">
            {loading ? (
              'Discovering groups...'
            ) : (
              <>
                No groups yet.
                <br />
                Create one to get started!
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5 pb-4">
            {groups.map((group) => {
              const isActive =
                (selectedUuid === group.uuid || selectedUuid === group.groupId) &&
                !!selectedUuid;
              return (
                <li key={group.uuid || group.groupId}>
                  <button
                    onClick={() => onSelectGroup(group.uuid || group.groupId)}
                    className={`w-full px-4 py-3 text-left rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-primary/20 to-transparent text-primary border-l-4 border-primary-container rounded-l-none'
                        : 'text-on-surface/60 hover:text-on-surface hover:bg-surface-container-high/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-primary/20' : 'bg-surface-container-high'
                      }`}>
                        <span
                          className="material-symbols-outlined text-sm"
                          style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                        >
                          forum
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate font-headline">{group.name}</p>
                        <p className="mt-0.5 text-[10px] text-on-surface-variant font-mono truncate">
                          {group.groupId.slice(0, 8)}...{group.groupId.slice(-6)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
