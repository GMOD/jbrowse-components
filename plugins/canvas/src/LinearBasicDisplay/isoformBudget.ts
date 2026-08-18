import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { TRANSCRIPT_PADDING_RATIO as ISOFORM_GAP_RATIO } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'

// Label lines the isoform cap budgets for a gene's own row: a name and a
// description, the most `decideLabelReservations` can reserve.
//
// A constant, not the two flags that actually decide it. Reading them would
// couple `maxIsoforms` — an RPC cache key — to `showLabels`, and a
// main-thread-only `showLabels` change refetching nothing is a pinned invariant
// (fetchAutorun.test.ts); `showLabels` also folds in the visible feature
// density, which would put a fetch-derived value in `rpcProps()`. So the cap
// budgets the worst case and can only leave a row unspent, never overflow —
// which is the right direction, because an unspent row is visible in the chip
// and one click from `All transcripts`, while an overflowing one is the silent
// scrollbar the cap exists to end.
const MAX_FEATURE_LABEL_LINES = 2

/**
 * What one gene costs the lane, split into the part that scales with the isoform
 * count and the part it pays once — the packer's own row arithmetic
 * (`decideLabelReservations` in layout.ts, over the stack `layoutSubfeatures`
 * builds), in the units the display measures its track height in.
 *
 * `perIsoformPx` is a body at this display mode plus the inter-transcript gap
 * `layoutSubfeatures` spends after it, plus — under `below` — the subfeature
 * label row the worker reserves for it. `geneOwnPx` is the mode's row padding
 * and the gene's own label lines, less the one gap the last isoform never
 * spends. So a gene of n one-row isoforms occupies `n * perIsoformPx +
 * geneOwnPx`, and `isoformRowBudget` is that solved for n.
 *
 * One-row isoforms and nothing else: a gene also hangs decorations beside them
 * (an NCBI source record, a `biological_region`) and an isoform can be taller
 * than a row (a polyprotein CDS draws one row per cleavage product). Neither is
 * visible from the main thread before the fetch, so this is a budget of ROWS
 * that the worker spends over the gene's real children — see
 * `isoformsWithinBudget` in subfeatures.ts, which reconstructs it from
 * `maxIsoforms` and charges each child what it measures.
 *
 * Exported as the pair rather than just the budget so a test can assert the two
 * agree with the packer, which is the only thing that makes the budget correct:
 * this arithmetic is a MIRROR of layout.ts's, and a mirror that drifts silently
 * admits an isoform past the lane it exists to fit.
 */
export function geneRowCostPx({
  featureHeightPx,
  displayMode,
  subfeatureLabelsBelow,
}: {
  // raw (normal-mode) body height, i.e. `budgetFeatureHeightPx` of the slot
  featureHeightPx: number
  displayMode: DisplayMode
  // `subfeatureLabels === 'below'`, the one setting that costs a row per isoform
  subfeatureLabelsBelow: boolean
}) {
  const bodyPx = featureHeightPx * HEIGHT_MULTIPLIERS[displayMode]
  const labelPx = labelFontSize(displayMode)
  // collapsed is a single-row overview and draws no labels at all
  const labelLines = displayMode === 'collapsed' ? 0 : MAX_FEATURE_LABEL_LINES
  return {
    perIsoformPx:
      bodyPx * (1 + ISOFORM_GAP_RATIO) + (subfeatureLabelsBelow ? labelPx : 0),
    geneOwnPx:
      ROW_PADDING[displayMode] +
      labelLines * labelPx -
      bodyPx * ISOFORM_GAP_RATIO,
  }
}

/**
 * How many isoforms of one gene fit a lane `trackHeightPx` tall — the packer's
 * arithmetic (`geneRowCostPx`) solved for n rather than approximated.
 *
 * At least 1 however short the lane: a gene collapsed to nothing is not an
 * overview of it, and the worker's own `isoformsWithinCap` floors at 1 too.
 */
export function isoformRowBudget(
  trackHeightPx: number,
  cost: ReturnType<typeof geneRowCostPx>,
) {
  return Math.max(
    1,
    Math.floor((trackHeightPx - cost.geneOwnPx) / cost.perIsoformPx),
  )
}
