import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// What a layout is asked for, and what the packer derives from it before any
// feature is read. A leaf module: the pack, the probes and the memo all take
// these, so it can depend on none of them.

// How names are chosen when `showLabels` is on. `all` reserves + renders every
// feature's name (the default, used at the `full`/`labels` fit rungs and in all
// non-fit modes); `fitWidth` keeps a name only where the feature's box is wide
// enough to host it (plus pinned/highlighted features), dropping the rest — the
// `decimated` fit rung's genuine intermediate between "every name" and "no name".
export type LabelDecimation = 'all' | 'fitWidth'

// One fetched region as layout sees it: the worker's result plus the region
// identity the model staples on at fetch time (`LoadedFeatureData` in
// baseModel.ts). Structural rather than an import of that type, so layout stays a
// pure function decoupled from the model — the same idiom as
// `BlockMeasurableRegion` in layoutQueries.ts.
//
// `regionKey` rides on the region, not in a parallel `Map<number, string>` beside
// it, and that is load-bearing. Grouping is BY this key, so a region whose key
// went missing would land in one group with every other keyless region and
// mis-stack against it — precisely the failure the grouping exists to prevent
// (see baseModel's note on why the identity is stored with the data at all). The
// parallel map made that state expressible and forced a `?? ''` fallback to
// swallow it; measured over ~14k lookups the fallback never fired, because
// `regionKeys` was built by walking this very map. Reading the key off the region
// makes the missing case a type error instead of a silent mis-stack.
export type LayoutRegionData = FeatureDataResult & { regionKey: string }

export interface LayoutInputs {
  bpPerPx: number
  showLabels: boolean
  showDescriptions: boolean
  reversedRegions: ReadonlySet<number>
  displayMode: DisplayMode
  // Feature ids the user pinned to the top: inserted first into the greedy
  // packer so they claim the lowest rows in their bp range (see packPreparedRef). Also
  // the always-keep set for `fitWidth` label decimation (never hide a name the
  // user pinned or searched for).
  pinnedFeatureIds: ReadonlySet<string>
  // Name-decimation policy (default `all`). See LabelDecimation.
  labelDecimation?: LabelDecimation
  // Whitespace multiplier for `fitWidth` decimation (default 1). The fit ladder
  // binary-searches it over [0, FIT_MAX_ROOM_FACTOR] to land the packed stack on
  // the track height: 0 keeps every name, higher values keep progressively fewer.
  // See keepFeatureLabel.
  labelRoomFactor?: number
  // At most this many isoforms per gene, or undefined for every one the worker
  // sent. The fit ladder's `isoforms` rung solves it against the track height —
  // names before isoforms, which is why it sits above `decimated` (ADR-092).
  maxIsoformsPerGene?: number
  // Genes the user opened from their own badge. Never trimmed, whatever the
  // count says.
  expandedGeneIds?: ReadonlySet<string>
  // The pile depth at which a sub-pixel mark gives up its row and shares row 0,
  // defaulting to DENSITY_COLLAPSE_DEPTH.
  collapseDepth?: number
  // Pack every feature onto row 0, the way `displayMode: 'collapsed'` does, but
  // without that mode's label suppression — a caller drawing a fixed-height
  // DENSITY BAND asks for this. The multi-sample variant lane is 40px holding a
  // whole callset: its records are meant to share pixels rather than each claim a
  // row, and stacking them honestly needs 68px, which costs the band every name
  // through the fit ladder.
  flattenRows?: boolean
  // Spend the worker's counted `below` subfeature-label rows at zero height —
  // the fit ladder's `bare` rung, which gives up rows the squeeze was about to
  // hide the text of anyway. The worker COUNTS these rows and the main thread
  // SPENDS them at `labelFontPx` (see reservesBelowLabelRow), which is what
  // makes this a pure layout input rather than a refetch.
  dropBelowLabelRows?: boolean
}

// A feature's row height: its body scaled by the display mode, plus the `below`
// label rows it contains spent at the mode's label font size rather than scaled
// with the geometry (see FeatureLayout.labelRowsAbove).
//
// Three passes need this exact term and have to agree on it — the pack's
// geometry, the trim's re-derivation at one isoform count, and the height scale
// that widens a gene's hit box. Split across them, a fitted track measures a
// labeled gene shorter than it draws.
export function bodyHeightPx(
  heightPx: number,
  labelRows: number | undefined,
  multiplier: number,
  labelFontPx: number,
) {
  return heightPx * multiplier + (labelRows ?? 0) * labelFontPx
}

// Everything the packer derives from the display mode. Bundled into one helper so
// the committed layout and the height probe cannot derive them differently — the
// probe is only trustworthy if it packs on byte-identical terms.
export interface DisplayModeMetrics {
  // compact/superCompact body scale (1 in normal mode)
  heightMultiplier: number
  // reserved height of one rendered label line
  labelFontPx: number
  // vertical gap between stacked rows
  rowPadding: number
  // collapsed mode: one shared row, no greedy stacking
  singleRow: boolean
}

export function displayModeMetrics(
  inputs: Pick<LayoutInputs, 'displayMode' | 'dropBelowLabelRows'>,
): DisplayModeMetrics {
  const { displayMode } = inputs
  return {
    heightMultiplier: HEIGHT_MULTIPLIERS[displayMode],
    // Zero at the `bare` rung, which spends the counted `below` label rows at
    // no height. Name/description rows are already off on the rung that asks
    // for this, so the below-row spend is the font size's only remaining job
    // there — see paddedLabelWidthPx for the width half of that claim.
    labelFontPx: inputs.dropBelowLabelRows ? 0 : labelFontSize(displayMode),
    rowPadding: ROW_PADDING[displayMode],
    // Labels are already forced off upstream in collapsed mode (model
    // showLabels/showDescriptions), so no row height is reserved for them.
    singleRow: displayMode === 'collapsed',
  }
}

// Layout inputs with the fit solve's knob deliberately absent. `prepareRefPack`
// takes this type so the compiler enforces what the solve depends on: the
// prepared half of a pack cannot read `labelRoomFactor`, therefore one prep is
// valid for every factor probed against it.
export type LabelRoomFactorFreeInputs = Omit<LayoutInputs, 'labelRoomFactor'>

// Layout inputs with the isoform solve's knob deliberately absent, the twin of
// `LabelRoomFactorFreeInputs`: one preparation is valid for every count probed
// against it, because the trim happens per count in `trimPreparedRef`.
export type IsoformCountFreeInputs = Omit<LayoutInputs, 'maxIsoformsPerGene'>
