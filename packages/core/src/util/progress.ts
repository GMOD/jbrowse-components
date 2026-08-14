import {
  checkStopTokenThrottled,
  createStopTokenChecker,
  withStopTokenCheck,
} from './stopToken.ts'
import { createTimeGate } from './timeGate.ts'

import type { StopToken, StopTokenChecker } from './stopToken.ts'

/**
 * Indeterminate phase: set `label` on the status channel, run `fn`, then clear
 * it. Pass `stopToken` and the phase becomes a cancellation boundary too — this
 * is the labelled form of {@link withStopTokenCheck}, so `fn` is checked on both
 * sides of its await and neither check has to be remembered at the call site.
 * The determinate counterpart is {@link withProgress}.
 *
 * The clear is absolute — `''`, not "restore whatever was there" — so these do
 * not nest: an inner phase blanks the label its caller set, for the rest of the
 * caller's work. Run phases in sequence, or give the inner one no
 * `statusCallback`. `cachedSetup` is the shape that keeps almost-tripping this,
 * which is why the in-memory adapters that report from inside their load omit
 * its `label`.
 */
export async function updateStatus<U>(
  msg: string,
  cb: StatusCallback | undefined,
  fn: () => U | Promise<U>,
  stopToken?: StopToken,
) {
  cb?.(msg)
  // finally, so a throwing `fn` doesn't leave its phase label sitting on the
  // channel forever — the error surfaces under a stale "Downloading file"
  try {
    return await withStopTokenCheck(stopToken, fn)
  } finally {
    cb?.('')
  }
}

/**
 * A value flowing through the RPC `statusCallback` channel.
 *
 * Historically this was always a plain human-readable string (e.g. "Loading
 * features"). It may now also carry determinate progress, which the loading UI
 * renders as a progress bar in addition to the message. Plain strings remain
 * valid for indeterminate phases, so existing callers are unaffected.
 */
export interface StatusWithProgress {
  message: string
  current: number
  total: number
}

export type RpcStatus = string | StatusWithProgress

/**
 * The single out-of-band status transport carried across the RPC boundary. A
 * plain string is an indeterminate phase label; a {@link StatusWithProgress}
 * adds a determinate fraction. Adapters wrap raw byte/block/feature counts into
 * this; the loading UI renders the message and (when present) a progress bar.
 */
export type StatusCallback = (status: RpcStatus) => void

/** Extract the human-readable text from any status value. */
export function statusMessageText(status: RpcStatus | undefined) {
  return typeof status === 'string' ? status : status?.message
}

/**
 * Fraction complete in [0,1], or undefined when the status is indeterminate
 * (a plain string, or a zero total).
 */
export function statusFraction(status: RpcStatus | undefined) {
  return typeof status === 'object' && status.total > 0
    ? Math.min(1, status.current / status.total)
    : undefined
}

// An RPC statusCallback fires per progress event (often ~40/s), and each write
// to the observable statusMessage/statusProgress re-renders whatever loading
// indicator is up (and repositions its MUI Tooltip/Popper) — re-renders were
// measured outpacing the zoom animation's own frame rate before this. A progress
// indicator gains nothing from updating faster.
const STATUS_THROTTLE_MS = 100

/**
 * Leading-edge throttle for a display's RPC progress stream: sparse updates pass
 * straight through, dense bursts are thinned. Create **one per display** and
 * share it across that display's status callbacks, so N parallel per-region
 * fetches thin to one stream between them rather than N.
 *
 * Deliberately wraps only the *callback* path, never `setStatusMessage` itself
 * — a display writing a phase label by hand ("Downloading" → "Parsing") is a
 * sequence of distinct labels, and a trailing edge only guarantees the *last*
 * of a burst, not each one in turn.
 *
 * Trailing, not merely leading: the last write of a phase is the one that
 * matters most and is exactly the one a leading-edge-only gate drops. A
 * determinate bar otherwise froze at whatever percentage happened to land on a
 * window boundary, and the `''` that {@link updateStatus}/{@link withProgress}
 * clear with — always the write closing a dense burst — left a finished phase's
 * label on screen until something else wrote. A trailing fire can land after
 * its own operation is torn down, so the guard on a sink has to be re-read
 * inside the throttled body; {@link createGuardedStatusSink} is that shape and
 * is what every owner should use rather than calling `run` directly.
 *
 * Both fetch families own one: `FetchMixin` for the LGV displays, and
 * `createStopTokenRotation` for the bare-autorun fetches (dotplot, synteny)
 * that compose no fetch mixin. A plain function rather than shared model state
 * because the two families declare their status fields separately and one set
 * shadows the other — see ADR-041.
 */
export function createStatusThrottle() {
  let lastMs = 0
  let pending: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const clearPending = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    pending = undefined
  }
  return {
    run(apply: () => void) {
      const now = Date.now()
      const wait = STATUS_THROTTLE_MS - (now - lastMs)
      if (wait <= 0) {
        // a write passing on the leading edge supersedes anything queued behind
        // it, so the trailing timer has nothing left to deliver
        clearPending()
        lastMs = now
        apply()
      } else {
        // only the newest write of a burst survives — an older progress value
        // is never what the user wants to be looking at
        pending = apply
        timer ??= setTimeout(() => {
          timer = undefined
          const run = pending
          pending = undefined
          if (run) {
            lastMs = Date.now()
            run()
          }
        }, wait)
      }
    },
    /**
     * Write now, dropping anything queued behind it. For a write that must land
     * AND that supersedes what it was queued behind — the `''` closing a phase
     * is both. Without this the trailing timer restores a percentage after the
     * work it measured has ended.
     */
    runNow(apply: () => void) {
      clearPending()
      lastMs = Date.now()
      apply()
    },
    /**
     * Reopen the window, so the next fetch reports its first status at once, and
     * drop any queued trailing write — a reset accompanies clearing the status,
     * which a late write from the fetch being reset would undo.
     */
    reset() {
      clearPending()
      lastMs = 0
    },
  }
}

/**
 * The status sink every owner of a progress stream wants: `sink` is called with
 * each status, throttled to {@link createStatusThrottle}'s window and skipped
 * entirely once `isCurrent()` goes false — a superseded fetch, or a torn-down
 * model.
 *
 * `isCurrent` is read twice on purpose. Once before the throttle, so a
 * superseded fetch's late status can't consume the window a live one is waiting
 * on; once inside, because a trailing write fires on a timer and the operation
 * it belongs to can be gone by then. That second read is the load-bearing one —
 * without it a trailing status lands on a destroyed MST node.
 *
 * A `''` is not throttled. It is how every phase helper says "this phase is
 * over", so it has to land, and it has to cancel whatever progress value was
 * queued behind it — otherwise the trailing timer puts a percentage back on
 * screen after the work it measured has ended.
 *
 * `throttle` defaults to a fresh window. Pass one to share it across an owner's
 * several callbacks, which is what makes N concurrent per-region fetches thin to
 * one stream between them rather than N (`FetchMixin` passes its model-wide one
 * through `throttleStatus`). A throttle with no `runNow` just writes the clear
 * straight through, which lands it but cannot cancel that owner's pending write.
 */
export function createGuardedStatusSink({
  isCurrent,
  sink,
  throttle = createStatusThrottle(),
}: {
  isCurrent: () => boolean
  sink: (status: RpcStatus) => void
  throttle?: {
    run: (apply: () => void) => void
    runNow?: (apply: () => void) => void
  }
}): StatusCallback {
  return status => {
    if (isCurrent()) {
      // re-read inside, because a trailing write fires on a timer and the
      // operation it belongs to can be gone by then
      const write = () => {
        if (isCurrent()) {
          sink(status)
        }
      }
      if (status === '') {
        ;(
          throttle.runNow ??
          (apply => {
            apply()
          })
        )(write)
      } else {
        throttle.run(write)
      }
    }
  }
}

/**
 * Format a phase label with a rounded percentage appended when a determinate
 * `fraction` is present (e.g. `progressLabel('Downloading', 0.45)` →
 * `"Downloading 45%"`). The single place the `X%` suffix is formatted: both
 * {@link statusProgressLabel} (RpcStatus callers) and the loading
 * overlays/indicators — which hold the message and fraction already split apart
 * onto the model — route through it, so no caller hand-rolls `Math.round`.
 */
export function progressLabel(
  message: string | undefined,
  fraction: number | undefined,
) {
  const percent = fraction === undefined ? '' : `${Math.round(fraction * 100)}%`
  return [message, percent].filter(Boolean).join(' ')
}

/**
 * {@link progressLabel} for an {@link RpcStatus}: the message, with a rounded
 * percentage appended when the status is determinate (e.g. `"Downloading 45%"`).
 * The form the loading dialogs use, holding the raw status object.
 */
export function statusProgressLabel(status: RpcStatus | undefined) {
  return progressLabel(statusMessageText(status), statusFraction(status))
}

/**
 * Adapt the byte-granularity download callback exposed by the readers
 * (generic-filehandle2 `readFile`, @gmod/tabix `getLines`, @gmod/bam /
 * @gmod/cram `getRecordsForRange`) to the structured {@link StatusCallback}
 * transport, labelling each tick with `message`. Returns undefined when there's
 * no `statusCallback`, so the reader can skip its progress bookkeeping entirely.
 *
 * `total` is optional because not every reader knows the size up front
 * (generic-filehandle2 omits it when the response has no Content-Length): with a
 * total we emit a determinate bar, without one we emit just the label so the UI
 * still shows the phase as an indeterminate spinner.
 *
 * Internal to this module — the only caller is {@link downloadStatus}, which is
 * the API adapters use. Kept separate purely so the reporter logic reads on its
 * own line.
 */
function downloadStatusReporter(
  statusCallback: StatusCallback | undefined,
  message: string,
) {
  return statusCallback
    ? (current: number, total?: number) => {
        statusCallback(
          total === undefined ? message : { message, current, total },
        )
      }
    : undefined
}

/**
 * Run a download phase with byte-granularity progress. Shows `label`, hands
 * `fn` the {@link downloadStatusReporter} to pass straight to an index reader's
 * `onProgress` (byte ticks upgrade the same label to a determinate bar), then
 * clears the status. Combines {@link updateStatus} with the reporter so the
 * label is written in exactly one place — the phase label and the progress
 * label can't drift apart.
 */
export async function downloadStatus<T>(
  label: string,
  statusCallback: StatusCallback | undefined,
  fn: (onProgress: ReturnType<typeof downloadStatusReporter>) => T | Promise<T>,
): Promise<T> {
  return updateStatus(label, statusCallback, () =>
    fn(downloadStatusReporter(statusCallback, label)),
  )
}

/**
 * Combine the in-flight statuses of several concurrent operations (one RPC per
 * visible region, say) into the single status the loading UI shows. Because
 * `current`/`total` are unit-agnostic and additive, determinate statuses are
 * summed into one Σcurrent/Σtotal bar — so N regions downloading in parallel
 * read as one honest bar instead of each clobbering the shared field. The
 * message is borrowed from a determinate status when any is present (regions
 * downloading at once share the same phase label), else the first status.
 * Returns undefined when nothing is in flight.
 *
 * An operation reporting no total is still an operation in flight, so it is
 * charged the mean of the totals we do know, with nothing completed against it.
 * Dropping those outright is what let a fan-out where one region's response
 * carried no Content-Length read 100% with that region still downloading.
 */
export function aggregateStatus(
  statuses: (RpcStatus | undefined)[],
): RpcStatus | undefined {
  const present = statuses.filter((s): s is RpcStatus => s !== undefined)
  const determinate = present.filter(
    (s): s is StatusWithProgress => typeof s === 'object',
  )
  if (determinate.length > 0) {
    let current = 0
    let measured = 0
    for (const s of determinate) {
      current += s.current
      measured += s.total
    }
    const indeterminate = present.length - determinate.length
    const total = measured + (indeterminate * measured) / determinate.length
    const [first] = determinate
    return { message: first ? first.message : '', current, total }
  } else {
    return present[0]
  }
}

/**
 * Fan one status field out to several concurrent operations that would
 * otherwise fight over it. Each `slot()` returns a {@link StatusCallback}
 * remembering only its own latest value; every write re-derives the shared
 * status from all slots through {@link aggregateStatus}, so N concurrent
 * downloads read as one Σcurrent/Σtotal bar instead of last-writer-wins — and
 * the first one to finish (which writes the `''` every phase helper clears
 * with) can't blank the label while the others are still running.
 *
 * The worker-side counterpart to `FetchMixin.setRegionStatus`, which does the
 * same keyed by region on the main thread. Use it wherever a `Promise.all` or
 * an rxjs `merge` hands one `statusCallback` to several operations at once.
 */
export function createStatusFanOut(statusCallback: StatusCallback | undefined) {
  const slots: (RpcStatus | undefined)[] = []
  return (): StatusCallback => {
    const index = slots.length
    slots.push(undefined)
    return status => {
      // '' is how updateStatus/downloadStatus signal "this phase is done", so
      // it retires the slot rather than contributing an empty message.
      slots[index] = status === '' ? undefined : status
      statusCallback?.(aggregateStatus(slots) ?? '')
    }
  }
}

/**
 * Call once per outer-loop iteration. With no argument it auto-increments an
 * internal counter (the elegant default — `for (…) report()`); pass an explicit
 * `current` when the caller tracks its own position, e.g. a running offset that
 * spans several batches.
 */
export type ProgressReporter = (current?: number) => void

/**
 * The single per-iteration callback for long synchronous worker loops. The
 * returned `report(current)` is called once per outer-loop iteration and does
 * two throttled jobs on each call:
 *
 * - checks the stop token via the existing throttled {@link checkStopTokenThrottled}
 *   machinery, so cancellation interrupts the loop within milliseconds instead
 *   of only at phase boundaries, and
 * - emits a {@link StatusWithProgress} through `statusCallback` at most once per
 *   `throttleMs`, so the main thread gets a live percentage without flooding
 *   the postMessage channel.
 *
 * Both jobs are optional: with no `statusCallback`/`total` this is purely a
 * throttled cancellation tick (the replacement for calling {@link
 * checkStopTokenThrottled} directly in a loop), so a loop has exactly one inner
 * callback whether or not it drives the progress UI.
 *
 * Emission is gated on wall-clock time (`throttleMs`) through {@link
 * createTimeGate}, which caps emits at ~1/throttleMs. This used to read the
 * clock on every call, reasoning that it was negligible next to the per-item
 * work; at a 666k-read pileup that measured ~28ms, so the gate now thins the
 * clock reads too — see createTimeGate for why its stride is learned rather
 * than fixed (a fixed one froze this bar at 0% for low-count/heavy phases).
 * Keep the loop a plain `for`; just call `report()` once per item (it owns the
 * counter) — or `report(n)` to report an explicit position.
 *
 * Reuses {@link createStopTokenChecker}, matching the cancellation convention
 * already used across the variant/alignments/gwas RPC paths.
 */
export function createProgressReporter({
  label = '',
  total,
  statusCallback,
  stopToken,
  stopTokenCheck,
  throttleMs = 100,
}: {
  label?: string
  total?: number
  statusCallback?: (status: RpcStatus) => void
  stopToken?: StopToken
  stopTokenCheck?: StopTokenChecker
  throttleMs?: number
}): ProgressReporter {
  const checker = stopTokenCheck ?? createStopTokenChecker(stopToken)
  const emitDue = createTimeGate()
  let count = 0
  return (current = count) => {
    count = current + 1
    checkStopTokenThrottled(checker)
    if (
      statusCallback !== undefined &&
      total !== undefined &&
      emitDue(throttleMs)
    ) {
      statusCallback({ message: label, current, total })
    }
  }
}

/**
 * Run a measurable phase: shows `label` at 0%, hands `fn` a {@link
 * ProgressReporter} to drive during the work, then checks the stop token once
 * more and clears the status. The determinate counterpart to `updateStatus`.
 */
export async function withProgress<T>(
  {
    label,
    total,
    statusCallback,
    stopToken,
  }: {
    label: string
    total: number
    statusCallback?: (status: RpcStatus) => void
    stopToken?: StopToken
  },
  fn: (report: ProgressReporter) => T | Promise<T>,
): Promise<T> {
  const report = createProgressReporter({
    label,
    total,
    statusCallback,
    stopToken,
  })
  report(0)
  try {
    return await withStopTokenCheck(stopToken, () => fn(report))
  } finally {
    statusCallback?.('')
  }
}
