import { downloadStatus } from './progress.ts'
import { calculateRedispatchRange } from './range.ts'
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
  const t2 = t1 === -1 ? -1 : line.indexOf('\t', t1 + 1)
  const t3 = t2 === -1 ? -1 : line.indexOf('\t', t2 + 1)
  // a truncated line has no column 3 to read; a final column 3 (no trailing
  // tab) runs to the end of the line rather than one character short of it
  return t2 === -1 ? '' : line.slice(t2 + 1, t3 === -1 ? line.length : t3)
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

/**
 * Read a region's tabix lines, then — if any feature found there extends past
 * the query — read once more over the union of the query and those feature
 * bounds, so a parent line's children (a gene's exons, a transcript's CDS)
 * outside the original window are pulled in and the parent/child tree resolves
 * fully. Types in `dontRedispatchSet` are excluded from the bounds, so one
 * chromosome-spanning record can't force a whole-chromosome refetch.
 *
 * Exactly one expansion happens: the second read's own overhang is not chased,
 * which bounds the work at two reads per query.
 *
 * Shared by the GFF3 and GTF tabix adapters, which differ only in how they
 * parse the returned lines.
 */
export async function readTabixLinesRedispatched(
  file: TabixLineSource,
  // the region's locus only — kept structural, like TabixLineSource above, so
  // this module stays free of the `types` barrel and its MST models
  query: { refName: string; start: number; end: number },
  dontRedispatchSet: Set<string>,
  opts: { statusCallback?: StatusCallback; stopToken?: StopToken } = {},
): Promise<TabixLine[]> {
  const { statusCallback, stopToken } = opts
  const read = (start: number, end: number) =>
    readTabixLines(file, query.refName, start, end, statusCallback, stopToken)

  const lines = await read(query.start, query.end)
  const redispatch = calculateRedispatchRange(
    lines,
    dontRedispatchSet,
    query.start,
    query.end,
  )
  return redispatch ? read(redispatch.start, redispatch.end) : lines
}
