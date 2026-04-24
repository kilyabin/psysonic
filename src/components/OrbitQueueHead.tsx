import { Users } from 'lucide-react';
import type { OrbitState } from '../api/orbit';

interface Props {
  state: OrbitState;
}

/**
 * Shared Orbit head strip rendered at the top of the queue for both host
 * and guest. Shows the session name and a comma-separated list of every
 * participant (host first, then guests in join order).
 */
export default function OrbitQueueHead({ state }: Props) {
  const names = [state.host, ...state.participants.map(p => p.user)];
  return (
    <div className="orbit-queue-head">
      <h2 className="orbit-queue-head__title">{state.name}</h2>
      <div className="orbit-queue-head__meta">
        <Users size={11} />
        <span className="orbit-queue-head__names">{names.join(', ')}</span>
      </div>
    </div>
  );
}
