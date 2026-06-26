import Flatbush from '@jbrowse/core/util/flatbush'

import { computeLabelExtraWidth } from './highlightUtils.ts'

// Extra pixels added to each side of every feature's hit box so small
// zoomed-out features (including un-stranded ones) remain hoverable.
export const HIT_PAD_PX = 4

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

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

export interface LabelVisibility {
  showLabels: boolean
  showDescriptions: boolean
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
  displayedRegionIndex: number
}

export type HitResult = HitFeatureResult | { feature: null; subfeature: null }

export function isHitFeature(r: HitResult): r is HitFeatureResult {
  return r.feature !== null
}

// Tooltip text for a hit: the subfeature under the cursor names its containing
// feature (a transcript/isoform, or a mature-peptide product), else the
// top-level feature's resolved `mouseover` slot. A hovered amino-acid letter
// adds its residue (e.g. `K124`) on top of that, so the isoform stays visible.
export function hoverTooltip(result: HitFeatureResult) {
  const isoform = result.subfeature?.displayLabel
  const { peptide } = result
  return peptide
    ? [isoform, `${peptide.aminoAcid}${peptide.proteinIndex + 1}`]
        .filter(Boolean)
        .join(' ')
    : (isoform ?? result.feature.tooltip)
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
  for (const item of items) {
    const padBp = HIT_PAD_PX * bpPerPx
    let hitStartBp = item.startBp - padBp
    let hitEndBp = item.endBp + padBp
    const labelData = floatingLabelsData[item.featureId]
    if (labelData) {
      const featureWidthPx = (item.endBp - item.startBp) / bpPerPx
      const extraBp =
        computeLabelExtraWidth(
          labelData,
          featureWidthPx,
          labels.showLabels,
          labels.showDescriptions,
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

// Codons aren't in a Flatbush index (they only exist when zoomed into
// peptide-level CDS, so the array is bounded by what's on screen); a linear
// scan mirrors the per-render scan in forEachRenderedPeptide. Returns the codon
// whose genomic span contains bpPos at the row under yPos.
function findPeptideAt(data: FeatureDataResult, bpPos: number, yPos: number) {
  const overlay = data.aminoAcidOverlay
  if (overlay) {
    for (const item of overlay) {
      if (
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

export function performMultiRegionHitDetection(
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>,
  flatbushIndexes: ReadonlyMap<number, FlatbushRegionIndexes>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
): HitResult {
  for (const vr of visibleRegions) {
    // Upper bound is exclusive so adjacent regions (regionA.screenEndPx ===
    // regionB.screenStartPx) don't both match at the shared pixel — the
    // earlier region would always win and steal clicks meant for the later one.
    if (mouseXPx >= vr.screenStartPx && mouseXPx < vr.screenEndPx) {
      const data = laidOutDataMap.get(vr.displayedRegionIndex)
      const indexes = flatbushIndexes.get(vr.displayedRegionIndex)
      if (data && indexes) {
        const blockWidth = vr.screenEndPx - vr.screenStartPx
        const reversed = vr.reversed ?? false
        const frac = (mouseXPx - vr.screenStartPx) / blockWidth
        const bpSpan = vr.end - vr.start
        const bpPos = reversed
          ? vr.end - frac * bpSpan
          : vr.start + frac * bpSpan

        let subfeature: SubfeatureInfo | null = null
        if (indexes.subfeature) {
          const idx = indexes.subfeature.search(bpPos, yPos, bpPos, yPos)[0]
          if (idx !== undefined) {
            subfeature = data.subfeatureInfos[idx]!
          }
        }

        if (indexes.feature) {
          const idx = indexes.feature.search(bpPos, yPos, bpPos, yPos)[0]
          if (idx !== undefined) {
            return {
              feature: data.flatbushItems[idx]!,
              subfeature,
              peptide: findPeptideAt(data, bpPos, yPos),
              displayedRegionIndex: vr.displayedRegionIndex,
            }
          }
        }
      }
    }
  }
  return { feature: null, subfeature: null }
}
