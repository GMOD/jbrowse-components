import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureFacet } from './facet.ts'

// A leaf module: the pack, the probes and the memo all take these, so it can
// depend on none of them.

export type LabelDecimation = 'all' | 'fitWidth'

// `regionKey` rides on the region, not in a parallel map: grouping is by this
// key, and reading it off the region makes a missing key a type error instead
// of a silent mis-stack.
export type LayoutRegionData = FeatureDataResult & { regionKey: string }

// The assembly is part of the key: two displayed regions can spell one refName
// on different assemblies, and grouped together their absolute bp coordinates
// stack against each other.
export function layoutRegionKey(region: {
  assemblyName: string
  refName: string
}) {
  return `${region.assemblyName}:${region.refName}`
}

export interface LayoutInputs {
  bpPerPx: number
  showLabels: boolean
  showDescriptions: boolean
  reversedRegions: ReadonlySet<number>
  displayMode: DisplayMode
  // Inserted first into the greedy packer, and the always-keep set for
  // `fitWidth` label decimation.
  pinnedFeatureIds: ReadonlySet<string>
  labelDecimation?: LabelDecimation
  labelRoomFactor?: number
  maxIsoformsPerGene?: number
  expandedGeneIds?: ReadonlySet<string>
  // Packs one section per facet value, stacked in `facetOrder` with a chip row
  // above each. Read off the hit items, so no refetch.
  facet?: FeatureFacet
  // A hidden section's features leave the pack. Keys mean nothing outside the
  // grouping that issued them, so the set is dropped when it changes.
  hiddenGroupKeys?: ReadonlySet<string>
  // Row 0 for everything without collapsed mode's label suppression, for a
  // fixed-height density band whose records are meant to share pixels.
  flattenRows?: boolean
  // The worker counts these rows and the main thread spends them at
  // `labelFontPx`, which is what makes this a layout input rather than a
  // refetch.
  dropBelowLabelRows?: boolean
  // The fit ladder's labels-first squeeze: bodies and padding shrink, label
  // rows keep their font size.
  bodyScale?: number
}

// Three passes need this exact term, the pack, the trim's re-derivation and
// the height scale; split, a fitted track measures a labeled gene shorter
// than it draws.
export function bodyHeightPx(
  heightPx: number,
  labelRows: number | undefined,
  multiplier: number,
  labelFontPx: number,
) {
  return heightPx * multiplier + (labelRows ?? 0) * labelFontPx
}

// One helper, so the committed layout and the height probe cannot derive them
// differently.
export interface DisplayModeMetrics {
  heightMultiplier: number
  labelFontPx: number
  rowPadding: number
  singleRow: boolean
}

export function displayModeMetrics(
  inputs: Pick<
    LayoutInputs,
    'displayMode' | 'dropBelowLabelRows' | 'bodyScale' | 'flattenRows'
  >,
): DisplayModeMetrics {
  const { displayMode, bodyScale = 1 } = inputs
  return {
    heightMultiplier: HEIGHT_MULTIPLIERS[displayMode] * bodyScale,
    // Zero at the `bare` rung, which spends the counted `below` rows at no
    // height.
    labelFontPx: inputs.dropBelowLabelRows ? 0 : labelFontSize(displayMode),
    rowPadding: ROW_PADDING[displayMode] * bodyScale,
    // The display mode's way of asking for one row, and the density band's,
    // answered once: split, the pack read one and the density collapse the
    // other.
    singleRow: displayMode === 'collapsed' || !!inputs.flattenRows,
  }
}

// `prepareRefPack` takes this type so the prepared half of a pack cannot read
// `labelRoomFactor`, making one prep valid for every factor probed.
export type LabelRoomFactorFreeInputs = Omit<LayoutInputs, 'labelRoomFactor'>

// Twin of `LabelRoomFactorFreeInputs`: one preparation is valid for every
// count, because the trim happens per count in `trimPreparedRef`.
export type IsoformCountFreeInputs = Omit<LayoutInputs, 'maxIsoformsPerGene'>
