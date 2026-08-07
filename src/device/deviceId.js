const STORAGE_KEY = "hilo:device-id";

// One random id per browser profile/install, persisted in localStorage --
// purely a manual-review signal (see supabase/schema.sql's game_sessions.
// device_id), never used to gate, throttle, or alter gameplay. Wrapped in
// try/catch since localStorage can throw (private browsing, disabled
// storage) -- on any failure this just returns null, and start_game()
// treats a missing device id as normal, pre-existing behavior.
export function getDeviceId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
