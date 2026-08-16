// Progress for a bulk render. A hundred junctions over a remote CRAM is minutes,
// and the two things a person wants to know are "is it moving" and "how long".
//
// Two shapes on purpose, chosen by whether stderr is a terminal:
//
// - **a terminal** gets ONE line, rewritten in place. A hundred lines of
//   `[57/100] wrote ...` is a wall that scrolls the run's actual output (the
//   skipped-record warning, the failures) off the screen.
// - **a pipe or a file** gets one line per record, because a log is read after
//   the fact and a carriage-returned bar collapses to gibberish in it. This is
//   also what CI captures.
//
// Failures print on their own line in both shapes, above the bar, so they
// survive the rewriting.

/** `2m10s`, `45s`, `1h04m`. Blank when there is nothing to estimate from yet. */
export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) {
    return ''
  }
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}h${String(m).padStart(2, '0')}m`
  }
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`
}

/**
 * The one-line bar.
 *
 * The ETA is a flat mean of the records finished so far rather than a windowed
 * rate, because the thing that actually varies here is per-record fetch size
 * (a junction into a deep repeat pulls far more read data than one in a quiet
 * arm) and a window over that swings wildly between neighbouring rows. A mean
 * over the whole run is the honest estimate for a queue of unknown-cost items.
 *
 * No ETA until two records are done: one sample of a network-bound render says
 * nothing, and a confidently wrong "eta 41m" on the first row is worse than
 * nothing.
 */
export function progressLine({
  done,
  total,
  failed,
  elapsedMs,
  width = 24,
}: {
  done: number
  total: number
  failed: number
  elapsedMs: number
  width?: number
}) {
  const frac = total === 0 ? 1 : done / total
  const filled = Math.round(frac * width)
  const bar = '#'.repeat(filled) + '-'.repeat(Math.max(0, width - filled))
  const pct = String(Math.round(frac * 100)).padStart(3)
  const counter = `${String(done).padStart(String(total).length)}/${total}`
  const eta =
    done >= 2 && done < total
      ? ` eta ${formatDuration((elapsedMs / done) * (total - done))}`
      : ''
  const failures = failed > 0 ? ` ${failed} failed` : ''
  return `[${bar}] ${pct}% ${counter}${eta}${failures}`
}

export interface ProgressReporter {
  /**
   * Called once per record, whether it rendered or failed; `error` is the
   * failure message. One call rather than a separate `fail`, because the queue
   * advances either way and two calls let the two counts disagree.
   */
  step: (label: string, error?: string) => void
  /** Final line; leaves the terminal on a fresh row. */
  finish: (summary: string) => void
}

// \r and a clear-to-end-of-line, so a shorter line does not leave the tail of
// the previous one behind. Written as an escape rather than carried as a raw
// control byte in the source, which is invisible in a diff and one stray
// reformat from disappearing.
const CLEAR_LINE = '\r\u001B[2K'

export function createProgress({
  total,
  isTty,
  write,
  now = () => Date.now(),
}: {
  total: number
  isTty: boolean
  write: (s: string) => void
  now?: () => number
}): ProgressReporter {
  const started = now()
  let done = 0
  let failed = 0
  return {
    step(label, error) {
      done++
      if (error) {
        failed++
      }
      if (isTty) {
        // the failure lands above the bar, on its own line, so the rewriting
        // cannot eat it
        if (error) {
          write(`${CLEAR_LINE}${error}\n`)
        }
        write(
          `${CLEAR_LINE}${progressLine({
            done,
            total,
            failed,
            elapsedMs: now() - started,
          })}`,
        )
      } else {
        // The counter leads whichever it was. A failure used to print its own
        // line and then an ordinary `[n/total] name` line under it, which in a
        // piped log reads exactly like a record that rendered.
        write(`[${done}/${total}] ${error ?? label}\n`)
      }
    },
    finish(summary) {
      write(isTty ? `${CLEAR_LINE}${summary}\n` : `${summary}\n`)
    },
  }
}
