import { createStatusFanOut, downloadStatus } from './progress.ts'
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
 * the query — read the overhang on either side, so a parent line's children (a
 * gene's exons, a transcript's CDS) outside the original window are pulled in
 * and the parent/child tree resolves fully. Types in `dontRedispatchSet` are
 * excluded from the bounds, so one chromosome-spanning record can't force a
 * whole-chromosome refetch.
 *
 * **The flanks, not the union.** Re-reading `[minStart, maxEnd]` returns
 * everything the first read already had — a second full read of the query range
 * to collect a gene's tail. At the window sizes a GFF3 track is browsed at that
 * is most of the work done twice, and it is the reason the download bar halved:
 * the expansion arrived as a second phase whose total was the whole region
 * again, so a region that had just reported 100% dropped to 50% and climbed back
 * (measured: two `65536/65536` phases for one query). Reading only what is
 * missing leaves the second phase the size of the overhang.
 *
 * The line sequence is unchanged by that. Tabix returns the lines *overlapping*
 * a range, so the three ranges' lines are the union range's lines, with the ones
 * straddling a boundary appearing twice; `offset` is a line's position in the
 * file, so deduplicating and sorting on it reconstructs file order — which for
 * an indexed file is coordinate order — exactly.
 *
 * The two flanks are read concurrently and so need a status slot each, or they
 * take turns overwriting one label. Exactly one expansion happens: a flank's own
 * overhang is not chased, which bounds the work at three reads per query and
 * usually two.
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
  const read = (start: number, end: number, cb?: StatusCallback) =>
    readTabixLines(file, query.refName, start, end, cb, stopToken)

  const lines = await read(query.start, query.end, statusCallback)
  const redispatch = calculateRedispatchRange(
    lines,
    dontRedispatchSet,
    query.start,
    query.end,
  )
  if (redispatch) {
    const slot = createStatusFanOut(statusCallback)
    const flanks = await Promise.all([
      redispatch.start < query.start
        ? read(redispatch.start, query.start, slot())
        : [],
      redispatch.end > query.end ? read(query.end, redispatch.end, slot()) : [],
    ])
    return mergeTabixLines([lines, ...flanks])
  }
  return lines
}

/**
 * The lines of several overlapping reads as one file-ordered run, each line
 * once. Keyed on `offset` because that is what a line *is* — its position in the
 * file — so a line two ranges both returned collapses to one entry and the sort
 * puts the whole set back in the order a single read over their union would have
 * produced.
 */
function mergeTabixLines(groups: TabixLine[][]) {
  const byOffset = new Map<number, TabixLine>()
  for (const group of groups) {
    for (const line of group) {
      byOffset.set(line.offset, line)
    }
  }
  return [...byOffset.values()].sort((a, b) => a.offset - b.offset)
}

/**
 * Minimal structural view of the `@gmod/tabix` call a header read needs, kept
 * structural for the same reason as {@link TabixLineSource}.
 */
interface TabixHeaderSource {
  getHeaderLines(): Promise<string[]>
}

/**
 * The header lines of a tabix-indexed file, however that file kept them.
 *
 * `getHeader()` alone is not that: it returns only lines beginning with the
 * index's meta character (`#`). A header that is a plain row — which is what
 * `tabix -S N` exists for, and what PLINK `.ld`, bedGraph and BED deflines
 * routinely are — comes back as the empty string, even though the index records
 * N in `skipLines`.
 *
 * Reading both is not backwards compatibility, and does not become unnecessary
 * once our own files are written with commented headers. A bare header is the
 * shape the data's publisher chose: Pan-UKB's TSVs and PLINK's `.ld` are
 * distributed that way, and `-S N` is the only way to index one without
 * rewriting a file the user did not write. Advice about how to generate a file
 * reaches the files we generate; this reaches the rest.
 *
 * An adapter that stops at `getHeader()` therefore cannot tell "this file has
 * no header" from "this file's header is not commented", and quietly falls back
 * to an assumed column layout. That has cost real information more than once: a
 * PLINK LD file lost its D' column, so `ldMetric: 'dprime'` silently served r²,
 * and a bedGraph loses the names of its value columns. Nothing errors, because
 * the assumed layout parses.
 *
 * That policy now lives in @gmod/tabix 3.5.4 as getHeaderLines, next to the
 * index metadata that decides it, so this is a delegate. Deciding it there also
 * costs one read of the file's leading blocks rather than two: asking for the
 * commented block and then the counted rows used to fetch and decompress the
 * same bytes twice, which every bare-header file did on every call.
 */
export function readTabixHeaderLines(
  file: TabixHeaderSource,
): Promise<string[]> {
  return file.getHeaderLines()
}
