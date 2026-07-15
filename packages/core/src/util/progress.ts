import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from './stopToken.ts'

import type { StopToken, StopTokenChecker } from './stopToken.ts'

/**
 * Indeterminate phase: set `label` on the status channel, run `fn`, then clear
 * it. Pass `stopToken` to check for cancellation before clearing (a no-op when
 * undefined). The determinate counterpart is {@link withProgress}.
 */
export async function updateStatus<U>(
  msg: string,
  cb: StatusCallback | undefined,
  fn: () => U | Promise<U>,
  stopToken?: StopToken,
) {
  cb?.(msg)
  const res = await fn()
  checkStopToken(stopToken)
  cb?.('')
  return res
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
    let total = 0
    for (const s of determinate) {
      current += s.current
      total += s.total
    }
    const [first] = determinate
    return { message: first ? first.message : '', current, total }
  } else {
    return present[0]
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
 * - checks the stop token via the existing throttled {@link checkStopToken2}
 *   machinery, so cancellation interrupts the loop within milliseconds instead
 *   of only at phase boundaries, and
 * - emits a {@link StatusWithProgress} through `statusCallback` at most once per
 *   `throttleMs`, so the main thread gets a live percentage without flooding
 *   the postMessage channel.
 *
 * Both jobs are optional: with no `statusCallback`/`total` this is purely a
 * throttled cancellation tick (the replacement for calling {@link
 * checkStopToken2} directly in a loop), so a loop has exactly one inner
 * callback whether or not it drives the progress UI.
 *
 * Emission is gated purely on wall-clock time (`throttleMs`), not a call
 * counter. Every caller invokes `report()` at the outer loop granularity — once
 * per feature/record, never per cell — so reading the clock each call is
 * negligible next to the per-item work, and the time gate alone caps emits at
 * ~1/throttleMs. An earlier call-count mask (only read the clock every 1024
 * calls) froze the bar at 0% for any phase with fewer items than the mask but
 * heavy per-item work — e.g. a multi-sample VCF region with a few hundred sites
 * but thousands of samples each never reached 1024 `report()` calls, so it only
 * ever emitted the initial tick. Keep the loop a plain `for`; just call
 * `report()` once per item (it owns the counter) — or `report(n)` to report an
 * explicit position.
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
  let lastReport = 0
  let count = 0
  return (current = count) => {
    count = current + 1
    checkStopToken2(checker)
    if (statusCallback !== undefined && total !== undefined) {
      const now = Date.now()
      if (now - lastReport >= throttleMs) {
        lastReport = now
        statusCallback({ message: label, current, total })
      }
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
  const res = await fn(report)
  checkStopToken(stopToken)
  statusCallback?.('')
  return res
}
