import { pingWithCredentials, scheduleInstantMixProbeForServer } from '../api/subsonic';
import type { ServerProfile } from '../store/authStore';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';

/**
 * Ping, update server identity / Instant Mix probe, set active server, clear local playback
 * and pull the new server's saved play queue.
 */
export async function switchActiveServer(server: ServerProfile): Promise<boolean> {
  try {
    const ping = await pingWithCredentials(server.url, server.username, server.password);
    if (!ping.ok) return false;
    const identity = {
      type: ping.type,
      serverVersion: ping.serverVersion,
      openSubsonic: ping.openSubsonic,
    };
    const auth = useAuthStore.getState();
    auth.setSubsonicServerIdentity(server.id, identity);
    scheduleInstantMixProbeForServer(server.id, server.url, server.username, server.password, identity);
    auth.setActiveServer(server.id);
    auth.setLoggedIn(true);
    usePlayerStore.getState().clearQueue();
    await usePlayerStore.getState().initializeFromServerQueue();
    return true;
  } catch {
    return false;
  }
}
