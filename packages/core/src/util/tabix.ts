import { downloadStatus } from './progress.ts'

import type { StatusCallback } from './progress.ts'

/**
 * A raw tabix line paired with the metadata the GFF3/GTF adapters need before
 * parsing: `offset` (the tabix byte offset) mints a stable per-feature id that
 * survives redispatch and panning, and start/end/type feed the redispatch
 * calculation (see {@link calculateRedispatchRange}) that runs before any line
 * is parsed.
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
 */
export function readTabixLines(
  gff: TabixLineSource,
  refName: string,
  start: number,
  end: number,
  statusCallback?: StatusCallback,
): Promise<TabixLine[]> {
  const lines: TabixLine[] = []
  return downloadStatus('Downloading features', statusCallback, onProgress =>
    gff.getLines(refName, start, end, {
      lineCallback: (line, offset, s, e) => {
        lines.push({ line, offset, start: s, end: e, type: extractType(line) })
      },
      onProgress,
    }),
  ).then(() => lines)
}
