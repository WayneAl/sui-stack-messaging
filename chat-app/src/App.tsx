import { useState, useCallback } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CreateGroupModal } from './components/CreateGroupModal';
import { useGroupDiscovery } from './hooks/useGroupDiscovery';

function App() {
  const account = useCurrentAccount();

  const {
    groups,
    loading: discoveryLoading,
    refresh: refreshGroups,
  } = useGroupDiscovery(account?.address);

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleGroupCreated = useCallback(
    (uuid: string) => {
      refreshGroups();
      setSelectedUuid(uuid);
    },
    [refreshGroups],
  );

  const handleLeaveGroup = useCallback(() => {
    setSelectedUuid(null);
    refreshGroups();
  }, [refreshGroups]);

  const selectedGroup =
    groups.find(
      (g) => g.uuid === selectedUuid || g.groupId === selectedUuid,
    ) ?? null;

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl px-6 h-16 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 droplet-gradient rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-fixed text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              waves
            </span>
          </div>
          <span className="font-headline text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-primary-container bg-clip-text text-transparent">
            HydroVault
          </span>
        </div>
        <ConnectButton />
      </header>

      {/* Body */}
      {account ? (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            groups={groups}
            selectedUuid={selectedUuid}
            onSelectGroup={setSelectedUuid}
            onCreateGroup={() => setShowCreateModal(true)}
            loading={discoveryLoading}
          />
          <ChatArea selectedGroup={selectedGroup} onLeaveGroup={handleLeaveGroup} />
        </div>
      ) : (
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 droplet-gradient rounded-2xl flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-on-primary-fixed text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                water_drop
              </span>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-surface tracking-tight">
                HydroVault
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Connect your wallet to access encrypted messaging
              </p>
            </div>
          </div>
        </main>
      )}

      {/* Create group modal */}
      {account && (
        <CreateGroupModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}

export default App;
