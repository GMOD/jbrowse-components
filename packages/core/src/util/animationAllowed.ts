import type { AnimationMode } from './types/index.ts'

/**
 * Whether a motion may play at all, before anything about what would move is
 * consulted: a frame clock has to exist, and the resolved animation mode has to
 * allow motion — 'enabled' always does, 'disabled' never does, and 'system'
 * honors the OS prefers-reduced-motion setting, so reduced-motion users get
 * instant snaps unless they explicitly opt in. The mode comes from the session
 * preference (`configuration.preferences.animationMode` + user override), which
 * is `getSession(self).animationMode`.
 *
 * In core rather than beside either caller because the two that ask are a
 * feature-layout morph in the canvas plugin and a viewport flight in the LGV,
 * and a second copy of this check is a second answer to "does this user want
 * motion" — the one a reduced-motion reader notices when only half the app
 * honors it.
 */
export function animationAllowed(mode: AnimationMode) {
  const hasFrameClock = typeof requestAnimationFrame === 'function'
  const prefersReduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    hasFrameClock &&
    (mode === 'enabled' || (mode === 'system' && !prefersReduced))
  )
}
