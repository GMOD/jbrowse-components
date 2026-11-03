// A terminal gets one line rewritten in place; a pipe gets a line per record,
// since a carriage-returned bar is gibberish in a log.

/** `2m10s`, `45s`, `1h04m` */
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

// The ETA is a whole-run mean, not a windowed rate, since per-record fetch size
// swings wildly between neighbouring rows.
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
  /** Called once per record, rendered or failed */
  step: (label: string, error?: string) => void
  finish: (summary: string) => void
}

// clears the line, so a shorter one leaves no tail of the previous
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
        // above the bar, so the rewriting cannot eat it
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
        write(`[${done}/${total}] ${error ?? label}\n`)
      }
    },
    finish(summary) {
      write(isTty ? `${CLEAR_LINE}${summary}\n` : `${summary}\n`)
    },
  }
}
