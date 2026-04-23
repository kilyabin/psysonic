import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, UserMinus, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrbitStore } from '../store/orbitStore';
import { useAuthStore } from '../store/authStore';
import { kickOrbitParticipant, buildOrbitShareLink } from '../utils/orbit';

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
  const { t } = useTranslation();
  const state = useOrbitStore(s => s.state);
  const role  = useOrbitStore(s => s.role);
  const sessionId = useOrbitStore(s => s.sessionId);
  const popRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const nowMs = Date.now();

  const shareLink = role === 'host' && sessionId
    ? buildOrbitShareLink(useAuthStore.getState().getActiveServer()?.url ?? '', sessionId)
    : null;

  const onCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* silent */ }
  };

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
        top:  anchor.bottom + 12,
        left: Math.max(8, anchor.left - 100),
        zIndex: 9999,
      }
    : { display: 'none' };

  const onKick = (username: string) => {
    void kickOrbitParticipant(username);
  };

  return createPortal(
    <div ref={popRef} className="orbit-participants-pop" style={style} role="menu">
      {shareLink && (
        <div className="orbit-participants-pop__invite">
          <div className="orbit-participants-pop__invite-label">{t('orbit.participantsInviteLabel')}</div>
          <div className="orbit-participants-pop__invite-row">
            <code className="orbit-participants-pop__invite-link">{shareLink}</code>
            <button
              type="button"
              className="orbit-participants-pop__invite-copy"
              onClick={onCopy}
              data-tooltip={copied ? t('orbit.tooltipCopied') : t('orbit.tooltipCopy')}
              aria-label={t('orbit.ariaCopyLink')}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}

      <div className="orbit-participants-pop__head">
        {t('orbit.participantsCountLabel', { count: state.participants.length + 1 })}
      </div>

      <div className="orbit-participants-pop__row orbit-participants-pop__row--host">
        <Crown size={13} />
        <span className="orbit-participants-pop__name">{state.host}</span>
        <span className="orbit-participants-pop__meta">{t('orbit.participantsHost')}</span>
      </div>

      {state.participants.length === 0 && (
        <div className="orbit-participants-pop__empty">{t('orbit.participantsEmpty')}</div>
      )}

      {state.participants.map(p => (
        <div key={p.user} className="orbit-participants-pop__row">
          <span className="orbit-participants-pop__name">{p.user}</span>
          <span className="orbit-participants-pop__meta">{joinedFor(p.joinedAt, nowMs)}</span>
          {role === 'host' && (
            <button
              type="button"
              className="orbit-participants-pop__kick"
              onClick={() => onKick(p.user)}
              data-tooltip={t('orbit.participantsKickTooltip')}
              aria-label={t('orbit.participantsKickAria', { user: p.user })}
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
