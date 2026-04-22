import { createPortal } from 'react-dom';
import { useOrbitStore } from '../store/orbitStore';
import { leaveOrbitSession } from '../utils/orbit';

/**
 * Orbit — exit notification modal.
 *
 * Shown when:
 *   - `phase === 'ended'` (host closed the session; guest sees it)
 *   - `phase === 'error' && errorMessage === 'kicked'` (host removed us)
 *
 * "OK" cleans up the guest-side outbox + resets the local store.
 */
export default function OrbitExitModal() {
  const phase        = useOrbitStore(s => s.phase);
  const errorMessage = useOrbitStore(s => s.errorMessage);
  const role         = useOrbitStore(s => s.role);
  const sessionName  = useOrbitStore(s => s.state?.name);
  const hostName     = useOrbitStore(s => s.state?.host);

  const isEnded  = phase === 'ended';
  const isKicked = phase === 'error' && errorMessage === 'kicked';
  if (!isEnded && !isKicked) return null;

  const title = isKicked
    ? 'You were removed from the session'
    : 'The host ended the session';
  const body = isKicked
    ? `@${hostName ?? 'host'} removed you from "${sessionName ?? 'the session'}".`
    : `"${sessionName ?? 'The session'}" has ended. Hope you had fun.`;

  const onOk = async () => {
    try {
      if (role === 'guest') await leaveOrbitSession();
      else useOrbitStore.getState().reset();
    } catch {
      useOrbitStore.getState().reset();
    }
  };

  return createPortal(
    <div
      className="modal-overlay orbit-exit-overlay"
      onClick={e => { if (e.target === e.currentTarget) onOk(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orbit-exit-title"
    >
      <div className="modal-content orbit-exit-modal">
        <h3 id="orbit-exit-title" className="orbit-exit-modal__title">{title}</h3>
        <p className="orbit-exit-modal__body">{body}</p>
        <div className="orbit-exit-modal__actions">
          <button type="button" className="btn btn-primary" onClick={onOk}>OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
