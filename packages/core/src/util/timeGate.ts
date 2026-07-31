// Target number of `Date.now()` reads per interval. Above 1 so the fire itself
// doesn't drift late when the call rate rises between two fires: the gate
// notices the interval has elapsed within ~1/this of it.
const CLOCK_READS_PER_INTERVAL = 8

// Ceiling on the learned stride. The stride is only ever an extrapolation from
// the last observed call rate, and the gate is blind between clock reads — if
// per-item cost jumps mid-loop the next read arrives late in wall-clock terms.
// This caps how blind it can get: a 10x mid-loop slowdown at a stride this size
// costs about one extra interval, which for a progress emit or a cancellation
// check is immaterial. At the rates that motivate a gate at all (hundreds of
// calls per ms) it is never the binding constraint.
const MAX_STRIDE = 8192

// The stride is re-aimed on every clock read, including ones taken part-way
// through an interval — otherwise the whole first interval runs at stride 1,
// which for a 666k-call loop is 33k clock reads before the gate learns
// anything. Those early samples span a short window, so cap how fast the stride
// may grow: the ramp still reaches MAX_STRIDE in five reads, but one
// unrepresentatively fast millisecond can't launch the gate straight to blind.
const STRIDE_GROWTH_LIMIT = 8

/**
 * A wall-clock gate for a callback invoked once per item in a long synchronous
 * loop: `due(intervalMs)` returns true at most once per `intervalMs`, without
 * calling `Date.now()` on every invocation.
 *
 * `Date.now()` costs ~40ns, invisible until the loop is a 666k-read pileup —
 * there it measured ~28ms per gated callsite, and the alignments worker has two
 * of them (the progress emit in `createProgressReporter` and the stop-token
 * check in `checkStopTokenThrottled`). Both previously read the clock per call, on the
 * documented reasoning that it was negligible next to the per-item work; at
 * this item count it measurably isn't.
 *
 * The stride between clock reads is **learned from the observed call rate**,
 * never fixed. A fixed stride is what regressed this before: a phase with few
 * but heavy items (a multi-sample VCF region — a few hundred sites, thousands
 * of samples each) never reached the count, so its progress bar froze at 0% and
 * its cancellation never fired. A learned stride makes exactly those loops
 * measure a low rate and hold a stride of 1, gating on time alone as before,
 * while a millions-of-calls loop thins itself out.
 *
 * `intervalMs` is per call rather than fixed at construction: it was added for
 * `checkStopTokenThrottled`, whose (since-deleted) sync-XHR probe backed off
 * linearly over a long loop. Both current callers pass a constant.
 */
export function createTimeGate() {
  let stride = 1
  let sinceClockRead = 0
  let callsSinceFire = 0
  let lastFire = 0
  return (intervalMs: number) => {
    callsSinceFire++
    if (++sinceClockRead < stride) {
      return false
    }
    sinceClockRead = 0
    const now = Date.now()
    // lastFire 0 is the first call ever — `now - 0` is the epoch, not an
    // elapsed time, and there is no rate to measure yet. Fire (so an initial
    // 0% tick is never swallowed) and start the window here.
    if (lastFire === 0) {
      lastFire = now
      callsSinceFire = 0
      return true
    }
    const elapsed = now - lastFire
    // elapsed 0 means the window fell inside one clock tick, which measures
    // nothing. Shrinking is unbounded (an estimate below the current stride
    // takes effect at once) so a slowdown is corrected on the next read.
    if (elapsed > 0) {
      stride = Math.min(
        MAX_STRIDE,
        stride * STRIDE_GROWTH_LIMIT,
        Math.max(
          1,
          Math.floor(
            (callsSinceFire * intervalMs) /
              (elapsed * CLOCK_READS_PER_INTERVAL),
          ),
        ),
      )
    }
    if (elapsed < intervalMs) {
      return false
    }
    lastFire = now
    callsSinceFire = 0
    return true
  }
}

export type TimeGate = ReturnType<typeof createTimeGate>
