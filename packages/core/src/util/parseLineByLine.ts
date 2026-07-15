import { IntervalTree } from './IntervalTree.ts'

import type { RpcStatus } from './progress.ts'

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
        const refName = line.slice(0, line.indexOf('\t'))
        ;(linesByRef[refName] ??= []).push(line)
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
 */
export function parseLineByLine(
  buffer: Uint8Array,
  lineCallback: LineCallback,
  statusCallback: StatusCallback = () => {},
) {
  const decoder = new TextDecoder('utf8')
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

    if (i++ % 10_000 === 0) {
      statusCallback({
        message: 'Loading',
        current: blockStart,
        total: buffer.length,
      })
    }

    // If no newline found, we've reached the end
    blockStart = lineEnd + 1
  }
}
