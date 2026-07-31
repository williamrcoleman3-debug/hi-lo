import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// Fire-and-forget, same philosophy as audio/sound.js -- the Haptics plugin
// no-ops on web (no vibration hardware/API to call), so these are safe to
// call unconditionally from shared game code that also runs in the browser.
// A failure here should never affect gameplay.

// Button press -- light tap, called the instant a call is registered.
export function hapticTap() {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

// Correct call.
export function hapticWin() {
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

// Bust.
export function hapticBust() {
  Haptics.notification({ type: NotificationType.Error }).catch(() => {});
}
