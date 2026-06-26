import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { LABEL_FONT_SIZE } from '../RenderFeatureDataRPC/constants.ts'
import {
  HEIGHT_MULTIPLIERS,
  STRAND_ARROW_WIDTH,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { maxLabelTextWidth } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

export const LAYOUT_Y_PADDING = 5

// Y offset applied to features that overflow GranularRectLayout's maxHeight.
// Pushes them far above the visible area so the renderer/hit-test drops them
// instead of stacking them at y=0. Float32 handles this magnitude losslessly.
const OFFSCREEN_Y = -1e6

export interface LayoutInputs {
  bpPerPx: number
  regionKeys: Map<number, string>
  showLabels: boolean
  showDescriptions: boolean
  reversedRegions: ReadonlySet<number>
  displayMode: DisplayMode
}

// Reserve strand-arrow space only on the side the arrow actually points,
// matching the per-direction padding the legacy renderer used. A forward
// feature points right (left in a reversed region) and vice versa, so the
// overhang lands on exactly one side; padding both sides made every gene
// STRAND_ARROW_WIDTH wider than needed and hurt packing density. A feature
// spanning both reversed and non-reversed regions points opposite ways in
// each, so it legitimately reserves on both sides.
function strandArrowPadding(ext: {
  strand: number
  hasReversed: boolean
  hasNonReversed: boolean
}) {
  const arrow = ext.strand ? STRAND_ARROW_WIDTH : 0
  const pointsLeft =
    (ext.hasNonReversed && ext.strand === -1) ||
    (ext.hasReversed && ext.strand === 1)
  const pointsRight =
    (ext.hasNonReversed && ext.strand === 1) ||
    (ext.hasReversed && ext.strand === -1)
  return {
    left: pointsLeft ? arrow : 0,
    right: pointsRight ? arrow : 0,
  }
}

function reservedLabelWidthPx(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
) {
  // Reserve exactly the measured text width, matching the legacy renderer — no
  // extra padding, which would widen every labeled feature and cut density.
  return maxLabelTextWidth(labelData, showLabels, showDescriptions)
}

// Scales all height/y fields in a cloned FeatureDataResult by the compact
// multiplier. Worker geometry is always in normal-mode units (multiplier=1);
// this makes compact/superCompact a pure main-thread operation.
function applyHeightScale(data: FeatureDataResult, multiplier: number) {
  if (multiplier === 1) {
    return
  }
  for (let i = 0; i < data.rectYs.length; i++) {
    data.rectYs[i]! *= multiplier
  }
  for (let i = 0; i < data.rectHeights.length; i++) {
    data.rectHeights[i]! *= multiplier
  }
  for (let i = 0; i < data.lineYs.length; i++) {
    data.lineYs[i]! *= multiplier
  }
  for (let i = 0; i < data.arrowYs.length; i++) {
    data.arrowYs[i]! *= multiplier
  }
  for (const item of data.flatbushItems) {
    item.featureHeightPx *= multiplier
  }
  for (const info of data.subfeatureInfos) {
    info.topPx *= multiplier
    info.bottomPx *= multiplier
  }
  for (const labelData of Object.values(data.floatingLabelsData)) {
    labelData.topY *= multiplier
    labelData.featureHeight *= multiplier
  }
  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx *= multiplier
    }
  }
}

// Pure layout. Raw data from the worker has Y coordinates relative to feature
// top (topPx = 0). This returns a new map where each region's Y values have
// been shifted by the per-feature top computed by GranularRectLayout.
// Regions sharing the same `assembly:refName` key share one layout so spanning
// features get the same Y in every region they appear in.
export function computeLaidOutData(
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LayoutInputs,
  // Per ref-group (`assembly:refName`) feature->row map from the previous
  // layout, used to keep feature Y stable across re-layouts (see packRef).
  seedLayoutMaps?: ReadonlyMap<string, ReadonlyMap<string, number>>,
  // Filled (when provided) with this pass's per-ref-group feature->row maps so
  // the next re-layout can seed from them.
  outLayoutMaps?: Map<string, Map<string, number>>,
): Map<number, FeatureDataResult> {
  const {
    bpPerPx,
    regionKeys,
    showLabels,
    showDescriptions,
    reversedRegions,
    displayMode,
  } = inputs
  const heightMultiplier = HEIGHT_MULTIPLIERS[displayMode]

  const out = new Map<number, FeatureDataResult>()
  // Empty regions need no layout mutations — share the raw object rather than
  // allocating clone arrays that will never be written.
  for (const [n, raw] of rpcDataMap) {
    if (raw.flatbushItems.length === 0) {
      out.set(n, raw)
    } else {
      const cloned = cloneMutableFields(raw)
      applyHeightScale(cloned, heightMultiplier)
      out.set(n, cloned)
    }
  }

  const refGroups = new Map<string, [number, FeatureDataResult][]>()
  for (const [displayedRegionIndex, data] of out) {
    if (data.flatbushItems.length === 0) {
      continue
    }
    const key = regionKeys.get(displayedRegionIndex) ?? ''
    let group = refGroups.get(key)
    if (!group) {
      group = []
      refGroups.set(key, group)
    }
    group.push([displayedRegionIndex, data])
  }

  for (const [key, regions] of refGroups) {
    const { layoutMap, layoutHeights } = packRef(
      regions,
      bpPerPx,
      showLabels,
      showDescriptions,
      reversedRegions,
      seedLayoutMaps?.get(key),
    )
    outLayoutMaps?.set(key, layoutMap)
    for (const [, data] of regions) {
      applyLayoutToRegion(data, layoutMap, layoutHeights)
    }
  }

  return out
}

interface GroupCache {
  bpPerPx: number
  showLabels: boolean
  showDescriptions: boolean
  displayMode: DisplayMode
  // idx -> raw fetch object, by reference. A new fetch swaps the reference.
  members: Map<number, FeatureDataResult>
  // members currently rendered reversed (affects label-overhang packing)
  reversed: Set<number>
  // idx -> laid-out result, reused verbatim when the group is unchanged
  output: Map<number, FeatureDataResult>
  // feature id -> row (px) from this group's last layout, used to seed the next
  layoutMap: Map<string, number>
}

function groupUnchanged(
  prev: GroupCache,
  members: Map<number, FeatureDataResult>,
  inputs: LayoutInputs,
) {
  const {
    bpPerPx,
    showLabels,
    showDescriptions,
    reversedRegions,
    displayMode,
  } = inputs
  const paramsSame =
    prev.bpPerPx === bpPerPx &&
    prev.showLabels === showLabels &&
    prev.showDescriptions === showDescriptions &&
    prev.displayMode === displayMode &&
    prev.members.size === members.size
  return (
    paramsSame &&
    [...members].every(
      ([idx, raw]) =>
        prev.members.get(idx) === raw &&
        prev.reversed.has(idx) === reversedRegions.has(idx),
    )
  )
}

// Seeding a re-layout from a prior one only makes sense when the vertical scale
// is unchanged: display mode and label visibility set each feature's row height,
// so if they differ the prior rows don't map to the new layout.
function canSeedFrom(
  prev: GroupCache | undefined,
  inputs: LayoutInputs,
): prev is GroupCache {
  return (
    prev?.displayMode === inputs.displayMode &&
    prev.showLabels === inputs.showLabels &&
    prev.showDescriptions === inputs.showDescriptions
  )
}

// Incremental wrapper over `computeLaidOutData`. Layout is independent per
// ref-group (`assembly:refName`) — regions on different chromosomes never
// affect each other's Y rows — so when one chromosome's data arrives only its
// group needs relaying out. This memoizes per group: a group whose member
// references and layout params are all unchanged reuses its previous output
// objects *by reference*, so the GPU upload autorun can skip re-uploading it.
//
// Without this, the single `laidOutDataMap` computed reclones every region on
// any change, so N chromosomes arriving sequentially cost O(N²) GPU uploads;
// per-group reuse makes it O(N). Hold one instance per display (the cache is
// stateful) and call it from the `laidOutDataMap` getter.
export function createIncrementalLayout() {
  let cache = new Map<string, GroupCache>()

  return function computeLaidOutDataIncremental(
    rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
    inputs: LayoutInputs,
  ): Map<number, FeatureDataResult> {
    const { regionKeys, reversedRegions } = inputs

    const groups = new Map<string, Map<number, FeatureDataResult>>()
    for (const [idx, raw] of rpcDataMap) {
      const key = regionKeys.get(idx) ?? ''
      let group = groups.get(key)
      if (!group) {
        group = new Map()
        groups.set(key, group)
      }
      group.set(idx, raw)
    }

    const out = new Map<number, FeatureDataResult>()
    const nextCache = new Map<string, GroupCache>()
    for (const [key, members] of groups) {
      const prev = cache.get(key)
      if (prev && groupUnchanged(prev, members, inputs)) {
        for (const [idx, result] of prev.output) {
          out.set(idx, result)
        }
        nextCache.set(key, prev)
      } else {
        // `members` all share one key, so the pure pass lays out exactly this
        // group; passing the full `regionKeys`/`reversedRegions` is fine since
        // it only reads the keys of regions present in `members`.
        // Seed from the prior layout only when the vertical scale is unchanged
        // (same display mode + label visibility); a scale change makes prior
        // rows meaningless, so let it repack cleanly.
        const seedLayoutMaps = canSeedFrom(prev, inputs)
          ? new Map([[key, prev.layoutMap]])
          : undefined
        const outLayoutMaps = new Map<string, Map<string, number>>()
        const output = computeLaidOutData(
          members,
          inputs,
          seedLayoutMaps,
          outLayoutMaps,
        )
        const reversed = new Set<number>()
        for (const idx of members.keys()) {
          if (reversedRegions.has(idx)) {
            reversed.add(idx)
          }
        }
        for (const [idx, result] of output) {
          out.set(idx, result)
        }
        nextCache.set(key, {
          bpPerPx: inputs.bpPerPx,
          showLabels: inputs.showLabels,
          showDescriptions: inputs.showDescriptions,
          displayMode: inputs.displayMode,
          members: new Map(members),
          reversed,
          output,
          layoutMap: outLayoutMaps.get(key) ?? new Map(),
        })
      }
    }
    // Dropping `cache` for `nextCache` evicts groups no longer present.
    cache = nextCache
    return out
  }
}

function cloneMutableFields(raw: FeatureDataResult) {
  const floatingLabelsData: Record<string, FeatureLabelData> = {}
  for (const [k, v] of Object.entries(raw.floatingLabelsData)) {
    floatingLabelsData[k] = { ...v }
  }
  return {
    ...raw,
    rectYs: new Float32Array(raw.rectYs),
    rectHeights: new Float32Array(raw.rectHeights),
    lineYs: new Float32Array(raw.lineYs),
    arrowYs: new Float32Array(raw.arrowYs),
    flatbushItems: raw.flatbushItems.map(item => ({ ...item })),
    subfeatureInfos: raw.subfeatureInfos.map(info => ({ ...info })),
    floatingLabelsData,
    aminoAcidOverlay: raw.aminoAcidOverlay?.map(aa => ({ ...aa })),
  }
}

function packRef(
  regions: [number, FeatureDataResult][],
  bpPerPx: number,
  showLabels: boolean,
  showDescriptions: boolean,
  reversedRegions: ReadonlySet<number>,
  prevLayoutMap?: ReadonlyMap<string, number>,
) {
  const layout = new GranularRectLayout({
    displayMode: 'normal',
    stableSeeding: prevLayoutMap !== undefined,
  })
  const layoutMap = new Map<string, number>()
  const layoutHeights = new Map<string, number>()

  const labelInfoByFeatureId = new Map<
    string,
    { hasName: boolean; hasDescription: boolean; maxLabelWidthPx: number }
  >()
  for (const [, data] of regions) {
    for (const labelData of Object.values(data.floatingLabelsData)) {
      const targetId = labelData.parentFeatureId ?? labelData.featureId
      const widthPx = reservedLabelWidthPx(
        labelData,
        showLabels,
        showDescriptions,
      )
      const existing = labelInfoByFeatureId.get(targetId)
      if (existing) {
        if (labelData.nameLabel) {
          existing.hasName = true
        }
        if (labelData.descriptionLabel) {
          existing.hasDescription = true
        }
        if (widthPx > existing.maxLabelWidthPx) {
          existing.maxLabelWidthPx = widthPx
        }
      } else {
        labelInfoByFeatureId.set(targetId, {
          hasName: !!labelData.nameLabel,
          hasDescription: !!labelData.descriptionLabel,
          maxLabelWidthPx: widthPx,
        })
      }
    }
  }

  // Track per-feature whether it appears in any reversed/non-reversed region
  // so label-overhang space can be reserved on the correct side(s). In a
  // reversed region the label visually extends toward lower bp, so the
  // overhang must widen layoutStartBp; otherwise it widens layoutEndBp.
  interface FeatureExtent {
    startBp: number
    endBp: number
    layoutStartBp: number
    layoutEndBp: number
    height: number
    strand: number
    hasReversed: boolean
    hasNonReversed: boolean
  }
  const allFeatures = new Map<string, FeatureExtent>()
  for (const [displayedRegionIndex, data] of regions) {
    const reversed = reversedRegions.has(displayedRegionIndex)
    for (const item of data.flatbushItems) {
      const existing = allFeatures.get(item.featureId)
      if (existing) {
        if (reversed) {
          existing.hasReversed = true
        } else {
          existing.hasNonReversed = true
        }
        continue
      }
      let height = item.featureHeightPx + LAYOUT_Y_PADDING
      const labelInfo = labelInfoByFeatureId.get(item.featureId)
      if (showLabels && labelInfo?.hasName) {
        height += LABEL_FONT_SIZE
      }
      if (showDescriptions && labelInfo?.hasDescription) {
        height += LABEL_FONT_SIZE
      }

      allFeatures.set(item.featureId, {
        startBp: item.startBp,
        endBp: item.endBp,
        layoutStartBp: item.startBp,
        layoutEndBp: item.endBp,
        height,
        strand: item.strand ?? 0,
        hasReversed: reversed,
        hasNonReversed: !reversed,
      })
    }
  }

  for (const [id, ext] of allFeatures) {
    const labelInfo = labelInfoByFeatureId.get(id)
    if (!labelInfo) {
      continue
    }
    const labelBp = labelInfo.maxLabelWidthPx * bpPerPx
    if (ext.hasNonReversed) {
      const labelEndBp = ext.startBp + labelBp
      if (labelEndBp > ext.layoutEndBp) {
        ext.layoutEndBp = labelEndBp
      }
    }
    if (ext.hasReversed) {
      const labelStartBp = ext.endBp - labelBp
      if (labelStartBp < ext.layoutStartBp) {
        ext.layoutStartBp = labelStartBp
      }
    }
  }

  const sorted = [...allFeatures.entries()].sort(
    ([, a], [, b]) => a.layoutStartBp - b.layoutStartBp,
  )
  let overflowCount = 0
  let firstOverflowSample: {
    id: string
    leftPx: number
    rightPx: number
    height: number
  } | null = null
  for (const [id, ext] of sorted) {
    const { left: arrowLeft, right: arrowRight } = strandArrowPadding(ext)
    const leftPx = ext.layoutStartBp / bpPerPx - arrowLeft
    const rightPx = ext.layoutEndBp / bpPerPx + arrowRight
    // Seed with the prior row only when it landed on-screen last time; an
    // overflowed feature (OFFSCREEN_Y) should repack from the top.
    const prevTop = prevLayoutMap?.get(id)
    const preferredRow =
      prevTop !== undefined && prevTop >= 0 ? prevTop : undefined
    const top = layout.addRect(
      id,
      leftPx,
      rightPx,
      ext.height,
      undefined,
      undefined,
      preferredRow,
    )
    if (top === null) {
      overflowCount++
      firstOverflowSample ??= { id, leftPx, rightPx, height: ext.height }
      layoutMap.set(id, OFFSCREEN_Y)
    } else {
      layoutMap.set(id, top)
    }
    layoutHeights.set(id, ext.height)
  }
  if (overflowCount > 0) {
    console.warn(
      `[canvas layout] overflow: ${overflowCount}/${sorted.length} features exceeded maxHeight ` +
        `(bpPerPx=${bpPerPx}, showLabels=${showLabels}, showDescriptions=${showDescriptions}) ` +
        `firstOverflow=${JSON.stringify(firstOverflowSample)}`,
    )
  }

  return { layoutMap, layoutHeights }
}

// Mutates the cloned region in place. Raw data has topPx=0 everywhere, so we
// simply add the per-feature offset rather than computing a delta from the
// previous layout. Callers must pass the clone produced by cloneMutableFields.
function applyLayoutToRegion(
  data: FeatureDataResult,
  layoutMap: Map<string, number>,
  layoutHeights: Map<string, number>,
) {
  const featureOffsets = new Float32Array(data.flatbushItems.length)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    featureOffsets[i] = layoutMap.get(data.flatbushItems[i]!.featureId) ?? 0
  }

  for (let i = 0; i < data.rectYs.length; i++) {
    data.rectYs[i] =
      data.rectYs[i]! + featureOffsets[data.rectFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.lineYs.length; i++) {
    data.lineYs[i] =
      data.lineYs[i]! + featureOffsets[data.lineFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.arrowYs.length; i++) {
    data.arrowYs[i] =
      data.arrowYs[i]! + featureOffsets[data.arrowFeatureIndices[i]!]!
  }

  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    const offset = featureOffsets[i]!
    const height = layoutHeights.get(item.featureId) ?? item.featureHeightPx
    item.topPx = offset
    item.bottomPx = offset + height
  }

  for (const info of data.subfeatureInfos) {
    const offset = layoutMap.get(info.parentFeatureId) ?? 0
    info.topPx += offset
    info.bottomPx += offset
  }

  // Drop labels whose feature overflowed maxHeight: the feature itself doesn't
  // render and we don't want to pay the React reconciliation cost of emitting
  // thousands of off-screen <div> labels in useFloatingLabels.
  for (const [key, labelData] of Object.entries(data.floatingLabelsData)) {
    const layoutKey = labelData.parentFeatureId ?? labelData.featureId
    const offset = layoutMap.get(layoutKey)
    if (offset === undefined || offset === OFFSCREEN_Y) {
      delete data.floatingLabelsData[key]
      continue
    }
    labelData.topY += offset
  }

  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += featureOffsets[aa.flatbushIdx]!
    }
  }
}
