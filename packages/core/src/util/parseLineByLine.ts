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

// Decode window. Deliberately small: the win over per-line decoding is in
// amortizing the per-call cost, which is already gone by a few KB, and a small
// window keeps the decoded string in cache and the extra memory bounded. A
// whole-buffer decode measured no faster and has two failure modes this avoids
// — it doubles peak memory, and V8 caps a string at ~512MB, which a large
// uncompressed GFF3 can exceed.
const DECODE_CHUNK_SIZE = 64 * 1024

const NEWLINE = 10

/**
 * End of the decode chunk starting at `start`: the nominal window extended
 * *forward* to just past the next newline, so a chunk never ends mid-line and
 * therefore never ends mid-character either (a newline byte cannot occur inside
 * a UTF-8 multi-byte sequence, whose continuation bytes are all >= 0x80). That
 * is what lets each chunk be decoded independently, without `{stream: true}`.
 *
 * Extending forward rather than trimming back to the previous newline matters
 * for a line longer than the window: trimming back has no newline to find and
 * would either split the line or stall, while extending simply makes one
 * oversized chunk and moves on.
 */
function chunkBoundary(buffer: Uint8Array, start: number) {
  const nominal = start + DECODE_CHUNK_SIZE
  if (nominal >= buffer.length) {
    return buffer.length
  }
  const nl = buffer.indexOf(NEWLINE, nominal)
  return nl === -1 ? buffer.length : nl + 1
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
  let chunkStart = 0
  let i = 0
  let stopped = false

  try {
    while (chunkStart < buffer.length) {
      const chunkEnd = chunkBoundary(buffer, chunkStart)
      // One decode per chunk rather than one per line. TextDecoder.decode costs
      // roughly a microsecond per call regardless of length, which a per-line
      // decode pays once per line: ~100ms of a 12MB/157k-line GFF3 was this
      // call alone, and the cost scales with line *count*, so the files that
      // suffer most are the dense ones. Slicing the decoded chunk instead is
      // ~4x faster over the same bytes.
      const text = decoder.decode(buffer.subarray(chunkStart, chunkEnd))

      let p = 0
      while (p < text.length) {
        const n = text.indexOf('\n', p)
        // the final chunk of a file with no trailing newline ends without one
        const lineEnd = n === -1 ? text.length : n
        const line = text.slice(p, lineEnd).trim()

        if (line) {
          const shouldContinue = lineCallback(line, i)
          if (shouldContinue === false) {
            stopped = true
            break
          }
        }

        i++
        // Chunk-granular position, not line-granular: `report` is called every
        // line so cancellation still lands within one throttle window, but the
        // byte offset it publishes only advances per chunk. Interpolating
        // within the chunk would mean converting a UTF-16 offset back to a byte
        // offset, and at 64KB the bar already moves in sub-percent steps.
        report(chunkStart)

        p = lineEnd + 1
      }
      if (stopped) {
        break
      }
      chunkStart = chunkEnd
    }
  } finally {
    // Cleared in a finally: on the happy path so the finished parse's last
    // percentage doesn't sit on screen through whatever unlabelled phase runs
    // next, and on a throw (or a cancel) so it doesn't sit under the error.
    statusCallback('')
  }
}
