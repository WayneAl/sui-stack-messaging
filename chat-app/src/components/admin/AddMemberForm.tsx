interface PermType {
  key: string;
  value: string;
}

interface AddMemberFormProps {
  newAddress: string;
  selectedPerms: string[];
  adding: boolean;
  addError: string | null;
  messagingPermTypes: PermType[];
  onAddressChange: (address: string) => void;
  onTogglePerm: (permValue: string) => void;
  onSelectAllPerms: () => void;
  onSubmit: (e: React.SyntheticEvent) => void;
}

export function AddMemberForm({
  newAddress,
  selectedPerms,
  adding,
  addError,
  messagingPermTypes,
  onAddressChange,
  onTogglePerm,
  onSelectAllPerms,
  onSubmit,
}: Readonly<AddMemberFormProps>) {
  return (
    <section className="border-b border-outline-variant/10 p-4">
      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        Add Member
      </h4>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="text"
          value={newAddress}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Sui address (0x...)"
          disabled={adding}
          className="w-full rounded-xl bg-surface-container-high border-none px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 font-mono"
        />

        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={selectedPerms.length === messagingPermTypes.length}
              onChange={onSelectAllPerms}
              disabled={adding}
              className="rounded accent-primary"
            />
            <span className="font-bold text-on-surface">Select All</span>
          </label>
          {messagingPermTypes.map((perm) => (
            <label
              key={perm.key}
              className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedPerms.includes(perm.value)}
                onChange={() => onTogglePerm(perm.value)}
                disabled={adding}
                className="rounded accent-primary"
              />
              {perm.key}
            </label>
          ))}
        </div>

        {addError && <p className="text-xs text-error">{addError}</p>}

        <button
          type="submit"
          disabled={adding}
          className="w-full rounded-full droplet-gradient py-2 text-xs font-bold text-on-primary-fixed disabled:opacity-50 transition-transform active:scale-95"
        >
          {adding ? 'Adding...' : 'Add Member'}
        </button>
      </form>
    </section>
  );
}
