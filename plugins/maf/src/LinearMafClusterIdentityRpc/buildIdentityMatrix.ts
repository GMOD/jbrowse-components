import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { formatBytes } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { DASH, LOWER_BIT, isUnknownBase } from '@jbrowse/core/util/alignedBytes'

import { loadMafSamplesAdapter } from '../util/loadMafSamplesAdapter.ts'

import type { MafAdapterBase } from '../util/MafAdapterBase.ts'
import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StatusCallback } from '@jbrowse/core/util/progress'
import type { ClusterMatrix } from '@jbrowse/tree-sidebar'

/**
 * How many columns the matrix gets, whatever the span. Clustering cost is
 * O(rows^2 x columns) and a cohort alignment is deep, so the bin count is
 * capped rather than derived from bp. A region shorter than this bins at one
 * reference base per column and the cap never binds.
 *
 * 5000 is where the return flattens. Clustering one 464-row alignment re-binned
 * costs 16 ms at 512 columns and 121 ms at 5000, and coarsening loses local
 * structure well before it loses global: the order 512 produces shares 35% of
 * its adjacent row pairs with the finest binning against 65% at 5000, while
 * Spearman against that binning is already 0.965 at 512. So the broad grouping
 * survives a coarse cap and which haplotype sits beside which does not, which
 * is the half a clustered display is read for. Doubling again to 10,000 buys
 * seven more points of adjacency for 273 ms.
 *
 * The budget these are spent against is a one-shot user action --
 * `runClustering` clears its own flag and no viewport move re-runs it -- not a
 * per-frame pass. measurements/maf-identity-column-cap.json.
 */
const MAX_COLUMNS = 5000

/** One region's slice of the concatenated row. */
interface RegionSegment {
  start: number
  end: number
  colOffset: number
  columns: number
  binWidth: number
}

/**
 * The column budget shared out among the displayed regions by span, each
 * region's slice contiguous and its own. Binning every region against one
 * `min(starts)`..`max(ends)` ruler instead put two chromosomes' positions in
 * the same bins and spent the budget on the gap between non-overlapping ones.
 * `columnSegments` in `@jbrowse/tree-sidebar/binColumns` is the same shape for
 * the same reason, but apportions its columns by pixel width rather than by
 * share of the span.
 *
 * A region gets at least one column and never more than it has bases, so a
 * whole-genome view of many small regions can exceed `MAX_COLUMNS` by at most
 * one column per region — clustering is a one-shot action and the alternative
 * is a region that bins to nothing.
 */
export function buildSegments(regions: Region[]) {
  const spans = regions.map(r => Math.max(1, r.end - r.start))
  const total = spans.reduce((a, b) => a + b, 0)
  const budget = Math.max(1, Math.min(MAX_COLUMNS, total))
  const segments: RegionSegment[] = []
  let colOffset = 0
  for (const [i, region] of regions.entries()) {
    const span = spans[i]!
    const columns = Math.min(
      span,
      Math.max(1, Math.round((span / total) * budget)),
    )
    segments.push({
      start: region.start,
      end: region.end,
      colOffset,
      columns,
      binWidth: span / columns,
    })
    colOffset += columns
  }
  return { segments, columns: colOffset }
}

/**
 * One row per genome, one column per bin of the reference, valued as the
 * fraction of the bin at which that genome both aligns and matches.
 *
 * The two things a MAF row can say are folded into one number on purpose. A row
 * is absent over a bin (no `s` line reaching it, or an `e` bridge) or present,
 * and where present it either matches the reference base or does not. Encoding
 * presence and identity as separate matrices would cluster the cohort twice and
 * leave the display to choose. So 0 means "nothing of this genome aligns here",
 * which is the signal a pangenome locus turns on -- at a copy-number locus whole
 * rows drop out -- and 1 means "aligned and identical to the reference across
 * the bin".
 *
 * THE DENOMINATOR IS THE BIN, not the row's own aligned length, and that is what
 * makes absence and divergence commensurable. Dividing by what the row covers
 * would score a haplotype aligning a tenth of the bin and matching perfectly
 * there as 1.0, the same as one aligning all of it, so the dropouts -- the
 * strongest structure in the data -- would cluster with the conserved rows.
 *
 * `sources` fixes the ROW ORDER, and the caller depends on it: `clusterMatrix`
 * returns an `order` of indices into this map's iteration order, and
 * `buildClusteredLayout` applies those indices to the display's own row array.
 * Seeding the map from `sources` before any block is read is what keeps the two
 * the same list; letting rows appear in whatever order the file's first block
 * happens to name them would silently permute the result.
 *
 * A genome in `sources` that no block covers keeps its all-zero row, so it
 * clusters with the other dropouts instead of leaving the tree a leaf short of
 * the rows on screen -- which `computeClusterHierarchy` rejects outright,
 * drawing no dendrogram at all.
 *
 * The reference is one of the rows where the file lists it, self-matching at
 * every column, so it comes out as an outgroup of one. That is honest: it is
 * the thing every other row is scored against.
 *
 * `columnBin` counts REFERENCE positions rather than alignment columns, so a
 * run of reference gaps -- an insertion carried by some other haplotype -- does
 * not dilute the bins around it, and leaves out a reference `N`, which no row
 * can match.
 */
export async function buildIdentityMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: Record<string, unknown>
    regions: Region[]
    sessionId: string
    sources: string[]
    byteLimit?: number
    signal?: AbortSignal
    statusCallback?: StatusCallback
  }
}): Promise<ClusterMatrix> {
  const {
    regions,
    adapterConfig,
    sessionId,
    sources,
    byteLimit,
    signal,
    statusCallback,
  } = args
  const { adapter } = await loadMafSamplesAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  // The same per-base read the detail tier gates, over the whole clustered
  // span; a refusal is an error here because a clustering run has no banner to
  // report into, only the dialog's error state or the notification sink.
  const { bytes, tooLarge } = await measureRegionBytes({
    dataAdapter: adapter,
    regions,
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooLarge) {
    throw new Error(
      `Too much alignment data to cluster over this span (${formatBytes(bytes!)} against a ${formatBytes(byteLimit!)} limit). Zoom in, or force-load the track to cluster it anyway.`,
    )
  }
  return readIdentityMatrix(adapter, regions, sources, args)
}

/**
 * The matrix {@link buildIdentityMatrix} returns, read off `adapter` with no
 * byte gate: each region's blocks through `readBlocks` into an
 * {@link IdentityMatrixSink}.
 */
export async function readIdentityMatrix(
  adapter: MafAdapterBase,
  regions: Region[],
  sources: string[],
  opts?: BaseOptions,
) {
  const { segments, columns } = buildSegments(regions)
  const sink = new IdentityMatrixSink(sources, columns, opts?.signal)
  for (const [regionIndex, region] of regions.entries()) {
    sink.segment = segments[regionIndex]!
    await adapter.readBlocks(region, sink, opts)
  }
  return sink.finish()
}

/**
 * Counts, per displayed genome and bin, the bases that match the reference,
 * off the ranges `readBlocks` hands it. An `e` line aligns no base, so
 * `addEmpty` counts nothing.
 */
class IdentityMatrixSink implements MafBlockSink {
  segment: RegionSegment | undefined

  // Seeded in `sources` order, and nothing is ever added to it: a genome the
  // file holds but the display is not drawing has no row here, and so cannot
  // shift the indices `order` is expressed in.
  private matched = new Map<string, Float32Array>()
  // The reference positions the blocks reached, per bin: every row's
  // denominator, so counted once per block rather than per row.
  private covered: Float32Array
  private columns: number
  private signal: AbortSignal | undefined

  // The block's bin per column (-1 for none) and its case-folded reference
  // byte, grown across blocks: real MAF is many small blocks (ce11 26-way's
  // median is 7bp), and `ColumnMapper` in `binning.ts` has the same shape.
  private columnBin = new Int32Array(0)
  private refFolded = new Uint8Array(0)
  private refLength = 0

  constructor(sources: string[], columns: number, signal?: AbortSignal) {
    for (const name of sources) {
      this.matched.set(name, new Float32Array(columns))
    }
    this.covered = new Float32Array(columns)
    this.columns = columns
    this.signal = signal
  }

  startBlock(
    _id: string,
    start: number,
    _end: number,
    _strand: number,
    ref: string,
    refFrom: number,
    refTo: number,
  ) {
    checkAbortSignal(this.signal)
    const { covered } = this
    const segment = this.segment!
    const n = refTo - refFrom
    if (this.columnBin.length < n) {
      this.columnBin = new Int32Array(n)
      this.refFolded = new Uint8Array(n)
    }
    const { columnBin, refFolded } = this
    this.refLength = n
    let refPos = start
    for (let c = 0; c < n; c++) {
      const refCode = ref.charCodeAt(refFrom + c)
      // soft-masked repeats are lower case in most MAFs, and a masked match
      // is still a match
      refFolded[c] = refCode | LOWER_BIT
      if (refCode === DASH) {
        columnBin[c] = -1
        continue
      }
      if (
        refPos >= segment.start &&
        refPos < segment.end &&
        !isUnknownBase(refCode)
      ) {
        const bin =
          segment.colOffset +
          Math.min(
            segment.columns - 1,
            Math.floor((refPos - segment.start) / segment.binWidth),
          )
        columnBin[c] = bin
        covered[bin]! += 1
      } else {
        columnBin[c] = -1
      }
      refPos++
    }
  }

  addRow(sampleId: string, text: string, from: number, to: number) {
    const row = this.matched.get(sampleId)
    if (!row) {
      return
    }
    const { columnBin, refFolded } = this
    const n = Math.min(to - from, this.refLength)
    for (let c = 0; c < n; c++) {
      const bin = columnBin[c]!
      if (bin < 0) {
        continue
      }
      const base = text.charCodeAt(from + c)
      if (base !== DASH && (base | LOWER_BIT) === refFolded[c]!) {
        row[bin]! += 1
      }
    }
  }

  addEmpty() {}

  finish() {
    const { matched, covered, columns } = this
    for (const row of matched.values()) {
      for (let bin = 0; bin < columns; bin++) {
        const denominator = covered[bin]!
        row[bin] = denominator > 0 ? row[bin]! / denominator : 0
      }
    }
    return matched
  }
}
