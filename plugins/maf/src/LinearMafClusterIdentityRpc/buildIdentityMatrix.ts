import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import { loadMafSamplesAdapter } from '../util/loadMafSamplesAdapter.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'

import type { AlignmentRecord } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'
import type { ClusterMatrix } from '@jbrowse/tree-sidebar'

const GAP = 45 // '-'

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
 * not dilute the bins around it.
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
    stopTokenCheck?: StopTokenChecker
  }
}): Promise<ClusterMatrix> {
  const { regions, adapterConfig, sessionId, sources, stopTokenCheck } = args
  const { adapter, samples: configSamples } = await loadMafSamplesAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const opts = configSamples.length ? { ...args, samples: configSamples } : args

  const start = Math.min(...regions.map(r => r.start))
  const end = Math.max(...regions.map(r => r.end))
  const span = Math.max(1, end - start)
  const columns = Math.max(1, Math.min(MAX_COLUMNS, span))
  const binWidth = span / columns

  // Seeded in `sources` order, and nothing is ever added to it: a genome the
  // file holds but the display is not drawing has no row here, and so cannot
  // shift the indices `order` is expressed in.
  const matched = new Map<string, Float32Array>()
  for (const name of sources) {
    matched.set(name, new Float32Array(columns))
  }
  // The reference positions the fetched blocks actually reached, per bin. Every
  // row shares this denominator, which is why it is counted once per block
  // rather than per row.
  const covered = new Float32Array(columns)

  for (const region of regions) {
    await subscribeToObservable(
      adapter.getFeatures(region, opts),
      (feature: Feature) => {
        checkStopTokenThrottled(stopTokenCheck)
        const refSeq = feature.get('seq') as string
        const alignments = feature.get('alignments') as Record<
          string,
          AlignmentRecord
        >
        const blockStart = feature.get('start')

        // Column -> bin, walked once per block and reused by every row in it. A
        // reference-gap column advances no reference position and is marked -1.
        const columnBin = new Int32Array(refSeq.length)
        let refPos = blockStart
        for (let c = 0; c < refSeq.length; c++) {
          if (refSeq.charCodeAt(c) === GAP) {
            columnBin[c] = -1
            continue
          }
          if (refPos >= start && refPos < end) {
            const bin = Math.min(
              columns - 1,
              Math.floor((refPos - start) / binWidth),
            )
            columnBin[c] = bin
            covered[bin]! += 1
          } else {
            columnBin[c] = -1
          }
          refPos++
        }

        for (const sampleId in alignments) {
          const row = matched.get(sampleId)
          if (!row) {
            continue
          }
          const { seq } = alignments[sampleId]!
          const n = Math.min(seq.length, refSeq.length)
          for (let c = 0; c < n; c++) {
            const bin = columnBin[c]!
            if (bin < 0) {
              continue
            }
            const base = seq.charCodeAt(c)
            // case-insensitive, since soft-masked repeat runs are lower case in
            // most MAFs and a masked match is still a match
            if (base !== GAP && (base | 32) === (refSeq.charCodeAt(c) | 32)) {
              row[bin]! += 1
            }
          }
        }
      },
    )
  }

  for (const row of matched.values()) {
    for (let bin = 0; bin < columns; bin++) {
      const denominator = covered[bin]!
      row[bin] = denominator > 0 ? row[bin]! / denominator : 0
    }
  }
  return matched
}
