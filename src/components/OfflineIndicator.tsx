import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-[65] flex items-center gap-2 rounded-2xl bg-[#1a1509] border border-amber-400/45 px-3.5 py-2 text-xs font-semibold text-amber-200 shadow-2xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Modo Offline — Jogando com dados em cache local.</span>
    </div>
  );
};
