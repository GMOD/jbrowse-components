import { downloadStatus } from './progress.ts'
import { withStopTokenSignal } from './stopToken.ts'

import type { StatusCallback } from './progress.ts'
import type { StopToken } from './stopToken.ts'

/**
 * A raw tabix line paired with the metadata the GFF3/GTF adapters need before
 * parsing: `offset` (the tabix byte offset) mints a stable per-feature id that
 * survives redispatch and panning, and start/end/type feed the redispatch
 * calculation (see {@link calculateRedispatchRange}) that runs before any line
 * is parsed.
 *
 * `start`/`end` are interbase, not the raw column values: @gmod/tabix applies
 * the index's coordinate offset (-1 for a 1-based-closed preset such as GFF)
 * before it calls back.
 */
export interface TabixLine {
  line: string
  offset: number
  start: number
  end: number
  type: string
}

/**
 * Minimal structural view of `@gmod/tabix`'s `TabixIndexedFile.getLines`, so
 * core needn't depend on `@gmod/tabix`.
 */
interface TabixLineSource {
  getLines(
    refName: string,
    start: number | undefined,
    end: number | undefined,
    opts: {
      lineCallback: (
        line: string,
        offset: number,
        start: number,
        end: number,
      ) => void
      onProgress?: (bytesDownloaded: number, totalBytes?: number) => void
      signal?: AbortSignal
    },
  ): Promise<void>
}

/**
 * Read the feature type (column 3) from a raw GFF3/GTF line without a full
 * split. Used only to classify a line for redispatch.
 */
function extractType(line: string) {
  const t1 = line.indexOf('\t')
  const t2 = line.indexOf('\t', t1 + 1)
  const t3 = line.indexOf('\t', t2 + 1)
  return line.slice(t2 + 1, t3)
}

/**
 * Fetch the tabix lines for a region under a "Downloading features" progress
 * label, capturing each line's byte offset, indexed start/end, and feature type
 * into a {@link TabixLine}. Shared by the GFF3 and GTF tabix adapters.
 *
 * The stop token becomes the read's `AbortSignal`, so a cancelled fetch drops
 * its block reads at the socket instead of downloading them and discarding the
 * lines. @gmod/tabix aborts a block shared between callers only once every
 * joined caller has aborted (`AggregateAbortController`), so this can't cancel a
 * chunk another region still needs.
 */
export function readTabixLines(
  gff: TabixLineSource,
  refName: string,
  start: number,
  end: number,
  statusCallback?: StatusCallback,
  stopToken?: StopToken,
): Promise<TabixLine[]> {
  const lines: TabixLine[] = []
  return withStopTokenSignal(stopToken, signal =>
    downloadStatus('Downloading features', statusCallback, onProgress =>
      gff.getLines(refName, start, end, {
        lineCallback: (line, offset, s, e) => {
          lines.push({
            line,
            offset,
            start: s,
            end: e,
            type: extractType(line),
          })
        },
        onProgress,
        signal,
      }),
    ),
  ).then(() => lines)
}
