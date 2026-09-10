/**
 * Every deadline on this path nests, and each one has to outlast the one it
 * carries: the code's own, the relay carrying it to the renderer, and the stdio
 * client waiting on the bridge. An inversion answers "did not answer in time"
 * over work that is still running, which is what `open` did — its inner settle
 * sat on the default relay budget, and the two summed past the client's.
 *
 * So the outer numbers are derived from the inner ones rather than typed
 * beside them, and `budgets.test.ts` walks the nesting. Its own module,
 * importing nothing, for the reason docLimits.ts is: the renderer reads
 * CODE_TIMEOUT_* and must not pull the tool prose or anything electron with it.
 */

// What one hop costs beyond the work it carries: the push, the answer, and a
// margin for a renderer busy enough to be late.
export const RELAY_MARGIN_MS = 15_000

export function relayBudget(innerMs: number) {
  return innerMs + RELAY_MARGIN_MS
}

// run_javascript's own deadline, raced inside the renderer so a runaway call
// answers with what it printed instead of a bare relay timeout.
export const CODE_TIMEOUT_DEFAULT_MS = 120_000
export const CODE_TIMEOUT_MAX_MS = 150_000

// A relay with nothing else to go on. Not derived: it bounds a call whose inner
// work declares no deadline of its own (measure, paint, a bare wait_ready).
export const RENDERER_TIMEOUT_MS = 150_000

// `open` polls for the new session, then waits for it to settle.
export const OPEN_WAIT_MS = 90_000
export const OPEN_SETTLE_MS = 60_000

// A screenshot waits for rendering to settle, then captures.
export const SCREENSHOT_WAIT_MS = 30_000
export const SCREENSHOT_WAIT_MAX_MS = 120_000

// The longest any single socket call can legitimately take, from the client's
// side of the bridge. `open` is the sum of its two phases; the others are one
// relay each.
export const LONGEST_CALL_MS = Math.max(
  relayBudget(CODE_TIMEOUT_MAX_MS),
  OPEN_WAIT_MS + relayBudget(OPEN_SETTLE_MS),
  relayBudget(SCREENSHOT_WAIT_MAX_MS),
  RENDERER_TIMEOUT_MS,
)

// What the stdio client waits before giving up on the bridge. One margin past
// the longest the bridge can honestly be working, so a timeout here means the
// app is wedged rather than busy.
export const BRIDGE_TIMEOUT_MS = relayBudget(LONGEST_CALL_MS)
