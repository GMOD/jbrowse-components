import Flatbush from '@jbrowse/core/util/flatbush'
import { bpAtPx, regionAtPixel } from '@jbrowse/render-core/canvas2dUtils'

import { computeLabelExtraWidth } from './labelPositioning.ts'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

// Every hit box grows by this on each side so a zoomed-out feature a pixel wide
// stays hoverable.
export const HIT_PAD_PX = 4

export interface VisibleRegion {
  refName: string
  displayedRegionIndex: number
  start: number
  end: number
  reversed?: boolean
  assemblyName: string
  screenStartPx: number
  screenEndPx: number
}

// A feature entry carries its region's render data so overlay code reads label
// widths without re-walking the data map.
export type FeatureItemEntry =
  | {
      kind: 'feature'
      item: FlatbushItem
      vr: VisibleRegion
      data: FeatureDataResult
    }
  | { kind: 'subfeature'; item: SubfeatureInfo; vr: VisibleRegion }

// Always positive: LGV emits start < end and carries the flip in `reversed`, so
// no signed span reaches here to read as "zoomed all the way in".
export function regionBpPerPx(vr: VisibleRegion) {
  return (vr.end - vr.start) / (vr.screenEndPx - vr.screenStartPx)
}

export interface LabelVisibility {
  showLabels: boolean
  showDescriptions: boolean
  fontSize: number
}

export interface FlatbushRegionIndexes {
  feature: Flatbush | null
  subfeature: Flatbush | null
}

export interface HitFeatureResult {
  feature: FlatbushItem
  subfeature: SubfeatureInfo | undefined
  peptide: AminoAcidOverlayItem | undefined
  bpPos: number
  bpPerPx: number
  displayedRegionIndex: number
}

// A floating label names its feature and nothing finer, so the hit it stands for
// carries no subfeature.
export function labelHit(
  feature: FlatbushItem,
  vr: VisibleRegion,
  mouseXPx: number,
): HitFeatureResult {
  return {
    feature,
    subfeature: undefined,
    peptide: undefined,
    bpPos: bpAtPx(mouseXPx, vr),
    bpPerPx: regionBpPerPx(vr),
    displayedRegionIndex: vr.displayedRegionIndex,
  }
}

export function buildFeatureFlatbushIndex(
  items: FlatbushItem[],
  floatingLabelsData: FeatureDataResult['floatingLabelsData'],
  bpPerPx: number,
  reversed: boolean,
  labels: LabelVisibility,
): Flatbush | null {
  if (items.length === 0) {
    return null
  }
  const index = new Flatbush(items.length)
  const padBp = HIT_PAD_PX * bpPerPx
  for (const item of items) {
    let hitStartBp = item.startBp - padBp
    let hitEndBp = item.endBp + padBp
    const labelData = floatingLabelsData.get(item.featureId)
    if (labelData) {
      const featureWidthPx = (item.endBp - item.startBp) / bpPerPx
      const extraBp =
        computeLabelExtraWidth(
          labelData,
          featureWidthPx,
          labels.showLabels,
          labels.showDescriptions,
          labels.fontSize,
        ) * bpPerPx
      if (extraBp > 0) {
        if (reversed) {
          hitStartBp -= extraBp
        } else {
          hitEndBp += extraBp
        }
      }
    }
    index.add(hitStartBp, item.topPx, hitEndBp, item.bottomPx)
  }
  index.finish()
  return index
}

export function buildSubfeatureFlatbushIndex(
  infos: SubfeatureInfo[],
): Flatbush | null {
  if (infos.length === 0) {
    return null
  }
  const index = new Flatbush(infos.length)
  for (const item of infos) {
    index.add(item.startBp, item.topPx, item.endBp, item.bottomPx)
  }
  index.finish()
  return index
}

// Flatbush returns matches in tree order, but the indexed arrays are populated
// in paint order, so the largest matching index is the one on top. `eligible`
// narrows the candidates before the topmost is chosen: filtering afterwards
// would discard an eligible match sitting under a neighbour's.
function topmostMatch(
  indices: number[],
  eligible: (index: number) => boolean = () => true,
) {
  let top: number | undefined
  for (const i of indices) {
    if ((top === undefined || i > top) && eligible(i)) {
      top = i
    }
  }
  return top
}

// Gated to codons the hit feature owns: pad and label overhang widen a feature's
// box, so a cursor inside one feature's padding can sit over a neighbour's
// codons.
function findPeptideAt(
  data: FeatureDataResult,
  bpPos: number,
  yPos: number,
  flatbushIdx: number,
) {
  const overlay = data.aminoAcidOverlay
  if (overlay) {
    for (const item of overlay) {
      if (
        item.flatbushIdx === flatbushIdx &&
        bpPos >= item.startBp &&
        bpPos < item.endBp &&
        yPos >= item.topPx &&
        yPos < item.topPx + item.heightPx
      ) {
        return item
      }
    }
  }
  return undefined
}

// The parentFeatureId gate rides in as topmostMatch's eligibility test, so it
// rejects an overlapping neighbour's subfeature among every candidate rather
// than only the one that happened to be on top.
function resolveSubfeature(
  data: FeatureDataResult,
  indexes: FlatbushRegionIndexes,
  bpPos: number,
  yPos: number,
  feature: FlatbushItem,
) {
  if (!indexes.subfeature) {
    return undefined
  }
  const idx = topmostMatch(
    indexes.subfeature.search(bpPos, yPos, bpPos, yPos),
    i => data.subfeatureInfos[i]!.parentFeatureId === feature.featureId,
  )
  return idx === undefined ? undefined : data.subfeatureInfos[idx]!
}

export function performMultiRegionHitDetection(
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>,
  flatbushIndexes: ReadonlyMap<number, FlatbushRegionIndexes>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
): HitFeatureResult | undefined {
  const vr = regionAtPixel(visibleRegions, mouseXPx)
  if (vr) {
    const data = laidOutDataMap.get(vr.displayedRegionIndex)
    const indexes = flatbushIndexes.get(vr.displayedRegionIndex)
    if (data && indexes?.feature) {
      const bpPos = bpAtPx(mouseXPx, vr)
      const idx = topmostMatch(indexes.feature.search(bpPos, yPos, bpPos, yPos))
      if (idx !== undefined) {
        const feature = data.flatbushItems[idx]!
        return {
          feature,
          subfeature: resolveSubfeature(data, indexes, bpPos, yPos, feature),
          peptide: findPeptideAt(data, bpPos, yPos, idx),
          bpPos,
          bpPerPx: regionBpPerPx(vr),
          displayedRegionIndex: vr.displayedRegionIndex,
        }
      }
    }
  }
  return undefined
}
