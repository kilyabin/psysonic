import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrbitAccountPickerStore } from '../store/orbitAccountPickerStore';

/**
 * Modal shown when joining an Orbit session and the user has more than
 * one account for the target server URL. Lets them pick which account
 * to switch to before the join flow continues. Mount once in App.tsx —
 * any caller can invoke it via `useOrbitAccountPickerStore.request(...)`.
 */
export default function OrbitAccountPicker() {
  const { t } = useTranslation();
  const { isOpen, accounts, pick, cancel } = useOrbitAccountPickerStore();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, cancel]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) cancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orbit-account-picker-title"
      style={{ alignItems: 'center', paddingTop: 0 }}
    >
      <div className="modal-content orbit-account-picker">
        <button type="button" className="modal-close" onClick={cancel} aria-label={t('orbit.btnCancel')}>
          <X size={18} />
        </button>
        <h3 id="orbit-account-picker-title" className="orbit-account-picker__title">
          {t('orbit.accountPickerTitle')}
        </h3>
        <p className="orbit-account-picker__sub">
          {t('orbit.accountPickerSub', { url: accounts[0]?.url ?? '' })}
        </p>
        <ul className="orbit-account-picker__list">
          {accounts.map(a => (
            <li key={a.id}>
              <button
                type="button"
                className="orbit-account-picker__item"
                onClick={() => pick(a)}
              >
                <User size={14} />
                <span className="orbit-account-picker__user">{a.username}</span>
                {a.name && <span className="orbit-account-picker__name">· {a.name}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="orbit-account-picker__actions">
          <button type="button" className="btn btn-ghost" onClick={cancel}>
            {t('orbit.btnCancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
