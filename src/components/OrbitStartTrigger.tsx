import { useState } from 'react';
import { Orbit as OrbitIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrbitStore } from '../store/orbitStore';
import OrbitStartModal from './OrbitStartModal';

/**
 * Topbar trigger — opens the start-session modal. Hidden while a session
 * is already active (role !== null) to avoid double-entry.
 */
export default function OrbitStartTrigger() {
  const { t } = useTranslation();
  const role = useOrbitStore(s => s.role);
  const [open, setOpen] = useState(false);

  if (role !== null) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-surface orbit-start-trigger"
        onClick={() => setOpen(true)}
        data-tooltip={t('orbit.triggerTooltip')}
        data-tooltip-pos="bottom"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
      >
        <OrbitIcon size={18} />
        <span>{t('orbit.triggerLabel')}</span>
      </button>
      {open && <OrbitStartModal onClose={() => setOpen(false)} />}
    </>
  );
}
