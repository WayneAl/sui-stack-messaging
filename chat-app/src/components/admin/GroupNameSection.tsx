interface GroupNameSectionProps {
  groupName: string;
  editingName: boolean;
  newName: string;
  renaming: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onNameChange: (name: string) => void;
  onRename: () => void;
}

export function GroupNameSection({
  groupName,
  editingName,
  newName,
  renaming,
  onEditStart,
  onEditCancel,
  onNameChange,
  onRename,
}: Readonly<GroupNameSectionProps>) {
  return (
    <section className="border-b border-outline-variant/10 p-4">
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        Group Name
      </h4>
      {editingName ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename();
              if (e.key === 'Escape') onEditCancel();
            }}
            disabled={renaming}
            className="flex-1 rounded-xl bg-surface-container-high border-none px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
            autoFocus
          />
          <button
            onClick={onRename}
            disabled={renaming}
            className="text-xs text-primary hover:text-primary-container transition-colors disabled:opacity-50"
          >
            {renaming ? '...' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          onClick={onEditStart}
          className="text-left text-sm text-on-surface hover:text-primary transition-colors flex items-center gap-1"
        >
          {groupName}
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '14px' }}>edit</span>
        </button>
      )}
    </section>
  );
}
