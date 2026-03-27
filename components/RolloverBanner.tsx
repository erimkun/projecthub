'use client';

import { useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function RolloverBanner() {
  const { showRolloverBanner, rolloverCount, setRolloverBanner } = useAppStore();

  useEffect(() => {
    if (showRolloverBanner) {
      const t = setTimeout(() => setRolloverBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showRolloverBanner, setRolloverBanner]);

  if (!showRolloverBanner) return null;

  return (
    <div className="rollover-banner" id="rollover-banner">
      <RefreshCw size={16} className="rollover-icon" />
      <div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          Haftalık Devir Tamamlandı
        </span>
        {' '}
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
          {rolloverCount} görev yeni haftaya taşındı
        </span>
      </div>
      <button
        className="btn-icon"
        style={{ marginLeft: 8 }}
        onClick={() => setRolloverBanner(false)}
      >
        <X size={14} />
      </button>
    </div>
  );
}
