import Flatbush from '@jbrowse/core/util/flatbush'
import { bpAtPx, regionAtPixel } from '@jbrowse/render-core/canvas2dUtils'

import { computeLabelExtraWidth } from './labelPositioning.ts'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

// Extra pixels added to each side of every feature's hit box so small
// zoomed-out features (including un-stranded ones) remain hoverable.
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

// Per-feature entry built by indexing flatbushItems/subfeatureInfos across
// every visible region. Feature entries carry their region's render data so
// overlay code can look up label widths without re-walking the data map.
export type FeatureItemEntry =
  | {
      kind: 'feature'
      item: FlatbushItem
      vr: VisibleRegion
      data: FeatureDataResult
    }
  | { kind: 'subfeature'; item: SubfeatureInfo; vr: VisibleRegion }

// The zoom this region is drawn at, always positive: LGV emits start < end and
// carries the flip in `reversed` (see calculateDynamicBlocks), so a signed span
// can't reach here and make `isBaseResolved` read a negative bpPerPx as "zoomed
// all the way in".
export function regionBpPerPx(vr: VisibleRegion) {
  return (vr.end - vr.start) / (vr.screenEndPx - vr.screenStartPx)
}

export interface LabelVisibility {
  showLabels: boolean
  showDescriptions: boolean
  // the display mode's resolved label font size, so the label-overhang part of a
  // hit box matches the width the label actually draws at
  fontSize: number
}

export interface FlatbushRegionIndexes {
  feature: Flatbush | null
  subfeature: Flatbush | null
}

export interface HitFeatureResult {
  feature: FlatbushItem
  subfeature: SubfeatureInfo | null
  // amino-acid codon under the cursor, when hovering peptide-level CDS
  peptide: AminoAcidOverlayItem | null
  // integer genomic position under the cursor, which the transcript readouts
  // are measured from, and the zoom it was read at, which decides how precise
  // a readout is honest
  bpPos: number
  bpPerPx: number
  displayedRegionIndex: number
}

type HitResult = HitFeatureResult | { feature: null; subfeature: null }

export function isHitFeature(r: HitResult): r is HitFeatureResult {
  return r.feature !== null
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

// "Whatever is drawn on top of the cursor wins", the one rule both picks below
// resolve by.
//
// Flatbush returns overlap matches in tree (Hilbert) order, unrelated to
// insertion order. Both `flatbushItems` and `subfeatureInfos` are populated in
// PAINT order and the index preserves it, so the largest matching index is the
// one painted last, i.e. the one on top. Overlaps are routine on both axes: the
// repeat_region case paints LTRs/TSDs over the internal retrotransposon body
// (see processRepeatRegionLayout), and collapsed display mode packs every
// feature onto row 0 (see packPreparedRef's singleRow).
//
// `eligible` narrows the candidates BEFORE the topmost is chosen, never after —
// picking first and filtering second answers "is the top one eligible?", which
// is a different (and wrong) question: the top match is regularly a neighbour's,
// and rejecting it there discards an eligible match sitting just under it.
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

// Codons aren't in a Flatbush index (they only exist when zoomed into
// peptide-level CDS, so the array is bounded by what's on screen); a linear
// scan mirrors the per-render scan in forEachRenderedPeptide. Returns the codon
// whose genomic span contains bpPos at the row under yPos, gated to codons
// belonging to the feature the hit resolved to (aminoAcidOverlay items carry
// their owning feature's flatbushItems index) — the same gate resolveSubfeature
// applies, and for the same reason: the feature boxes are widened by pad and
// label overhang, so a cursor inside one feature's padding can sit over a
// neighbour's codons, which would then be tooltipped as this feature's residue.
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
  return null
}

// The topmost subfeature under the cursor that belongs to `feature`. Gating on
// parentFeatureId (the top-level feature id, see glyphEmitters) prevents a
// subfeature of an overlapping neighbor from being paired with `feature` — it
// rides in as topmostMatch's eligibility test, so the gate applies to every
// candidate rather than only to the one that happened to be on top.
function resolveSubfeature(
  data: FeatureDataResult,
  indexes: FlatbushRegionIndexes,
  bpPos: number,
  yPos: number,
  feature: FlatbushItem,
): SubfeatureInfo | null {
  if (!indexes.subfeature) {
    return null
  }
  const idx = topmostMatch(
    indexes.subfeature.search(bpPos, yPos, bpPos, yPos),
    i => data.subfeatureInfos[i]!.parentFeatureId === feature.featureId,
  )
  return idx === undefined ? null : data.subfeatureInfos[idx]!
}

export function performMultiRegionHitDetection(
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>,
  flatbushIndexes: ReadonlyMap<number, FlatbushRegionIndexes>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
): HitResult {
  const vr = regionAtPixel(visibleRegions, mouseXPx)
  if (vr) {
    const data = laidOutDataMap.get(vr.displayedRegionIndex)
    const indexes = flatbushIndexes.get(vr.displayedRegionIndex)
    if (data && indexes?.feature) {
      // The base the cursor is over. bpAtPx owns the reversed pivot: flooring
      // the raw inverse names the neighbouring base on each base's leftmost
      // pixel column of a flipped region.
      const bpPos = bpAtPx(mouseXPx, vr)
      // Features' hit boxes are padded by label width and can overlap a
      // neighbor's box, so pick the topmost (last-painted = largest index)
      // rather than whatever Flatbush yields first.
      const idx = topmostMatch(indexes.feature.search(bpPos, yPos, bpPos, yPos))
      if (idx !== undefined) {
        const feature = data.flatbushItems[idx]!
        return {
          feature,
          // The topmost subfeature by the same rule, restricted to ones this
          // feature owns. The two indexes search independently and the feature
          // boxes are widened by pad/label overhang while the subfeature index
          // is not, so an ungated subfeature could pair with the neighbouring
          // feature — showing its isoform tooltip while select acts on this one.
          subfeature: resolveSubfeature(data, indexes, bpPos, yPos, feature),
          peptide: findPeptideAt(data, bpPos, yPos, idx),
          bpPos,
          bpPerPx: regionBpPerPx(vr),
          displayedRegionIndex: vr.displayedRegionIndex,
        }
      }
    }
  }
  return { feature: null, subfeature: null }
}
