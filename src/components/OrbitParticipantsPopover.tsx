import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Crown, UserMinus } from 'lucide-react';
import { useOrbitStore } from '../store/orbitStore';
import { kickOrbitParticipant } from '../utils/orbit';

interface Props {
  /** Anchor — we position the popover directly below its bottom-right. */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

function joinedFor(fromMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm.toString().padStart(2, '0')}`;
}

export default function OrbitParticipantsPopover({ anchorRef, onClose }: Props) {
  const state = useOrbitStore(s => s.state);
  const role  = useOrbitStore(s => s.role);
  const popRef = useRef<HTMLDivElement>(null);
  const nowMs = Date.now();

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  if (!state) return null;

  const anchor = anchorRef.current?.getBoundingClientRect();
  const style: React.CSSProperties = anchor
    ? {
        position: 'fixed',
        top:  anchor.bottom + 6,
        left: Math.max(8, anchor.left - 100),
        zIndex: 9999,
      }
    : { display: 'none' };

  const onKick = (username: string) => {
    void kickOrbitParticipant(username);
  };

  return createPortal(
    <div ref={popRef} className="orbit-participants-pop" style={style} role="menu">
      <div className="orbit-participants-pop__head">
        {state.participants.length + 1} in session
      </div>

      <div className="orbit-participants-pop__row orbit-participants-pop__row--host">
        <Crown size={13} />
        <span className="orbit-participants-pop__name">@{state.host}</span>
        <span className="orbit-participants-pop__meta">host</span>
      </div>

      {state.participants.length === 0 && (
        <div className="orbit-participants-pop__empty">No guests yet</div>
      )}

      {state.participants.map(p => (
        <div key={p.user} className="orbit-participants-pop__row">
          <span className="orbit-participants-pop__name">@{p.user}</span>
          <span className="orbit-participants-pop__meta">{joinedFor(p.joinedAt, nowMs)}</span>
          {role === 'host' && (
            <button
              type="button"
              className="orbit-participants-pop__kick"
              onClick={() => onKick(p.user)}
              data-tooltip="Remove from session"
              aria-label={`Remove @${p.user}`}
            >
              <UserMinus size={12} />
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
