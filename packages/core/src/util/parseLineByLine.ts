import { IntervalTree } from './IntervalTree.ts'
import { createProgressReporter } from './progress.ts'

import type { RpcStatus } from './progress.ts'
import type { StopToken } from './stopToken.ts'

export type StatusCallback = (arg: RpcStatus) => void
export type LineCallback = (
  line: string,
  lineIndex: number,
) => boolean | undefined

/**
 * Scan a tab-delimited genomic flat file (GFF3, GTF, BED, …), grouping
 * feature lines by reference name (first tab-delimited column).
 * Stops at an embedded FASTA section (`>`). Lines starting with `#` are
 * collected as header lines.
 */
export function groupLinesByRef(
  buffer: Uint8Array,
  statusCallback?: StatusCallback,
): { headerLines: string[]; linesByRef: Record<string, string[]> } {
  const headerLines: string[] = []
  const linesByRef: Record<string, string[]> = {}
  parseLineByLine(
    buffer,
    line => {
      if (line.startsWith('#')) {
        headerLines.push(line)
      } else if (line.startsWith('>')) {
        return false
      } else {
        // a line with no tab has no coordinate columns either, so it cannot be
        // a feature line; keying it by its own text would publish it through
        // getRefNames as a phantom refName
        const tab = line.indexOf('\t')
        if (tab !== -1) {
          ;(linesByRef[line.slice(0, tab)] ??= []).push(line)
        }
      }
      return true
    },
    statusCallback,
  )
  return { headerLines, linesByRef }
}

/**
 * Build a `refName -> lazy IntervalTree` map from feature lines grouped by ref
 * (the output of {@link groupLinesByRef}). Each ref's lines are parsed and
 * indexed into an interval tree on first access, then the raw lines are
 * released. Shared scaffolding for the plain-text GFF3 and GTF adapters, which
 * differ only in how they parse a ref's lines into features.
 */
export function makeFeatureIntervalTreeMap<
  T extends { start: number; end: number },
>(
  linesByRef: Record<string, string[]>,
  parse: (lines: string[], refName: string) => T[],
  parsingStatusMessage: string,
) {
  const cache: Record<string, IntervalTree<T>> = {}
  return Object.fromEntries(
    Object.entries(linesByRef).map(([refName, refLines]) => {
      let lines: string[] | null = refLines
      return [
        refName,
        (statusCallback?: StatusCallback) => {
          if (!cache[refName]) {
            statusCallback?.(parsingStatusMessage)
            const intervalTree = new IntervalTree<T>()
            for (const feature of parse(lines!, refName)) {
              intervalTree.insert([feature.start, feature.end], feature)
            }
            lines = null
            cache[refName] = intervalTree
          }
          return cache[refName]
        },
      ]
    }),
  )
}

/**
 * Parse buffer line by line, calling a callback for each line
 * @param buffer - The buffer to parse
 * @param lineCallback - Callback function called for each line. Return false to stop parsing.
 * @param statusCallback - Optional callback for progress updates
 * @param opts - `label` names the phase on the progress bar (a multi-phase
 *   adapter wants "Parsing PAF", not another "Loading" indistinguishable from
 *   the download that preceded it); `stopToken` makes a multi-GB parse
 *   interruptible instead of running to completion after a cancel.
 */
export function parseLineByLine(
  buffer: Uint8Array,
  lineCallback: LineCallback,
  statusCallback: StatusCallback = () => {},
  opts: { label?: string; stopToken?: StopToken } = {},
) {
  const { label = 'Loading', stopToken } = opts
  const decoder = new TextDecoder('utf8')
  // Time-gated, not gated on a line counter: a file of few but very expensive
  // lines would never reach a count mask, freezing the bar at 0% for the whole
  // parse (the failure createProgressReporter documents). The stop-token check
  // rides the same tick, so cancellation lands within one window.
  const report = createProgressReporter({
    label,
    total: buffer.length,
    statusCallback,
    stopToken,
  })
  let blockStart = 0
  let i = 0

  while (blockStart < buffer.length) {
    const n = buffer.indexOf(10, blockStart)
    // could be a non-newline ended file, so subarray to end of file if n===-1
    const lineEnd = n === -1 ? buffer.length : n
    const b = buffer.subarray(blockStart, lineEnd)
    const line = decoder.decode(b).trim()

    if (line) {
      const shouldContinue = lineCallback(line, i)
      if (shouldContinue === false) {
        break
      }
    }

    i++
    report(blockStart)

    // If no newline found, we've reached the end
    blockStart = lineEnd + 1
  }
  // Clear, so the finished parse's last percentage doesn't sit on screen
  // through whatever unlabelled phase the caller runs next.
  statusCallback('')
}
