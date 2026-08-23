import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { TRANSCRIPT_PADDING_RATIO as ISOFORM_GAP_RATIO } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'

// The most `decideLabelReservations` can reserve for a gene's own row. A
// constant rather than a read of `showLabels`/`showDescriptions`, which are
// fetch-derived: reading them would make `maxIsoforms` — an RPC cache key —
// refetch on a label toggle (fetchAutorun.test.ts pins against it). The worst
// case can leave a row unspent, never overflow.
const MAX_FEATURE_LABEL_LINES = 2

/**
 * What one gene costs the lane: `n * perIsoformPx + geneOwnPx` for n one-row
 * isoforms. A MIRROR of `decideLabelReservations`' row arithmetic (layout.ts) —
 * one that drifts silently admits an isoform past the lane the cap exists to
 * fit, so it is exported as the pair for a test to pin against the packer.
 *
 * One-row isoforms is an estimate the main thread cannot improve on: a gene also
 * hangs decorations beside them and an isoform can be taller than a row, neither
 * visible before the fetch. So this is a budget of ROWS the worker re-spends
 * over the real children (`isoformsWithinBudget` in subfeatures.ts).
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
  // collapsed is a single-row overview and draws no labels at all — not the
  // gene's own lines, and not the `below` row under each isoform, which
  // `rpcProps` forces to `none` before the payload leaves
  const labeled = displayMode !== 'collapsed'
  const labelLines = labeled ? MAX_FEATURE_LABEL_LINES : 0
  return {
    // a body at this mode plus the gap `layoutSubfeatures` spends after it, plus
    // — under `below` — the label row the worker reserves under it
    perIsoformPx:
      bodyPx * (1 + ISOFORM_GAP_RATIO) +
      (labeled && subfeatureLabelsBelow ? labelPx : 0),
    // the mode's row padding and the gene's own label lines, less the one gap
    // the last isoform never spends
    geneOwnPx:
      ROW_PADDING[displayMode] +
      labelLines * labelPx -
      bodyPx * ISOFORM_GAP_RATIO,
  }
}

/**
 * How many isoforms of one gene fit a lane `trackHeightPx` tall — `geneRowCostPx`
 * solved for n. At least 1 however short the lane, matching the floor in the
 * worker's own `isoformsWithinBudget`.
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

/**
 * What a gene's own rows — the mode's padding and its label lines — cost in
 * `isoformRowBudget` units.
 *
 * Rows rather than pixels because that is the only form that survives the trip
 * to the worker, which knows neither the display mode nor the label font (see
 * `DisplayConfig.geneOwnRows`). `isoformRowBudget` spends this once, for the one
 * gene it sizes against the whole lane; a lane several genes stack in owes it
 * once per gene, and re-spending it is what `laneBudgetRows` is for.
 */
export function geneOwnRows(cost: ReturnType<typeof geneRowCostPx>) {
  return cost.geneOwnPx / cost.perIsoformPx
}
