import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { TRANSCRIPT_PADDING_RATIO as ISOFORM_GAP_RATIO } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'

// The most `decideLabelReservations` can reserve for a gene's own row, budgeted
// as a constant rather than read off `showLabels`/`showDescriptions`. Those are
// main-thread-only and fetch-derived (`showLabels` folds in feature density), so
// reading them would make `maxIsoforms` — an RPC cache key — refetch on a label
// toggle, which fetchAutorun.test.ts pins against. Budgeting the worst case can
// leave a row unspent, never overflow: an unspent row is visible in the chip and
// one click from `All transcripts`, an overflowing one is the silent scrollbar
// the cap exists to end.
const MAX_FEATURE_LABEL_LINES = 2

/**
 * What one gene costs the lane, split into the part that scales with the isoform
 * count and the part it pays once — `decideLabelReservations`' own row
 * arithmetic (layout.ts), in the units the display measures its track height in.
 * A gene of n one-row isoforms occupies `n * perIsoformPx + geneOwnPx`, and
 * `isoformRowBudget` is that solved for n.
 *
 * One-row isoforms and nothing else: a gene also hangs decorations beside them
 * (an NCBI source record, a `biological_region`) and an isoform can be taller
 * than a row (a polyprotein CDS draws one per cleavage product). The main thread
 * sees neither before the fetch, so this is a budget of ROWS that the worker
 * re-spends over the gene's real children — `isoformsWithinBudget` in
 * subfeatures.ts, which charges each child what it measures.
 *
 * Exported as the pair rather than just the budget so a test can pin it against
 * the packer: this is a MIRROR of layout.ts's arithmetic, and one that drifts
 * silently admits an isoform past the lane it exists to fit.
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
    // a body at this mode plus the gap `layoutSubfeatures` spends after it, plus
    // — under `below` — the label row the worker reserves under it
    perIsoformPx:
      bodyPx * (1 + ISOFORM_GAP_RATIO) + (subfeatureLabelsBelow ? labelPx : 0),
    // the mode's row padding and the gene's own label lines, less the one gap
    // the last isoform never spends
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
 * overview of it, and the worker's own `isoformsWithinBudget` floors at 1 too.
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
