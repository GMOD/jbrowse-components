import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from './stopToken.ts'

import type { StopToken, StopTokenChecker } from './stopToken.ts'

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
 * Adapt the byte-granularity download callback exposed by the index readers
 * (@gmod/tabix `getLines`, @gmod/bam / @gmod/cram `getRecordsForRange`) to the
 * structured {@link StatusCallback} transport, labelling each tick with
 * `message`. Returns undefined when there's no `statusCallback`, so the reader
 * can skip its progress bookkeeping entirely.
 */
export function downloadStatusReporter(
  statusCallback: StatusCallback | undefined,
  message: string,
) {
  return statusCallback
    ? (current: number, total: number) => {
        statusCallback({ message, current, total })
      }
    : undefined
}

/** Call once per outer-loop iteration with the number of items completed. */
export type ProgressReporter = (current: number) => void

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
  return current => {
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
