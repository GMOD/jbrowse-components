import Flatbush from '@jbrowse/core/util/flatbush'

import { isBaseResolved } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { hgvsPosition, locateOnTranscript } from '../hgvsPosition.ts'
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
  // genomic position under the cursor, which the transcript readouts are
  // measured from, and the zoom it was read at, which decides how precise a
  // readout is honest
  bpPos: number
  bpPerPx: number
  displayedRegionIndex: number
}

export type HitResult = HitFeatureResult | { feature: null; subfeature: null }

export function isHitFeature(r: HitResult): r is HitFeatureResult {
  return r.feature !== null
}

// The transcript the cursor resolved to, if any: the subfeature's when it landed
// on an isoform of a gene, else the top-level feature's own.
export function hitTranscript(result: HitFeatureResult) {
  return result.subfeature?.transcript ?? result.feature.transcript
}

// What the hover says about a position on a transcript: the exon it is in, and
// its HGVS coordinate.
//
// The exon is named only for an EXONIC position — naming the flanking exon of an
// intron would read as "you are in exon 5" when you are not, and the c. offset
// (`c.87+1`) already says which boundary you are past. A single-exon transcript
// says nothing: "exon 1/1" is noise.
//
// The c./n. coordinate needs the cursor to resolve to one base, so it appears
// only at base zoom (see isBaseResolved) — off by a base, it would be worse than
// absent.
function transcriptReadouts(result: HitFeatureResult) {
  const coords = hitTranscript(result)
  const located = coords && locateOnTranscript(coords, result.bpPos)
  return {
    exon:
      located?.offset === 0 && located.exonCount > 1
        ? `exon ${located.exonNumber}/${located.exonCount}`
        : undefined,
    hgvs:
      coords && isBaseResolved(result.bpPerPx)
        ? hgvsPosition(coords, result.bpPos)
        : undefined,
  }
}

// The position as a clinical report would write it: the transcript's accession
// — whatever the annotation names it, which for RefSeq/Ensembl GFF3 is the
// versioned accession — joined to its c./n. coordinate, `NM_004006.2:c.93+1`.
// Falls back to the bare coordinate when the transcript is unnamed. Undefined
// unless the cursor resolved to a transcript at base zoom.
//
// This is the position half of an HGVS variant name; the change itself
// (`…c.93+1G>T`) needs an allele, which a gene annotation doesn't carry.
export function hgvsHitLabel(result: HitFeatureResult) {
  const coords = hitTranscript(result)
  const position =
    coords && isBaseResolved(result.bpPerPx)
      ? hgvsPosition(coords, result.bpPos)
      : undefined
  const accession = result.subfeature?.displayLabel ?? result.feature.name
  return position && accession ? `${accession}:${position}` : position
}

// Tooltip text for a hit: the subfeature under the cursor names its containing
// feature (a transcript/isoform, or a mature-peptide product), else the
// top-level feature's resolved `mouseover` slot. On a transcript the exon and
// HGVS coordinate under the cursor are named too — clinical reporting is written
// in those terms, and neither is practical to work out by eye. A hovered
// amino-acid letter adds its residue (e.g. `K124`) on top of that, so the
// isoform stays visible.
export function hoverTooltip(result: HitFeatureResult) {
  const isoform = result.subfeature?.displayLabel
  const { peptide } = result
  const { exon, hgvs } = transcriptReadouts(result)
  return (
    peptide
      ? [isoform, exon, hgvs, `${peptide.aminoAcid}${peptide.proteinIndex + 1}`]
      : [isoform ?? result.feature.tooltip, exon, hgvs]
  )
    .filter(Boolean)
    .join(' ')
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
    const labelData = floatingLabelsData[item.featureId]
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

// Flatbush returns overlap matches in tree (Hilbert) order, unrelated to
// insertion order. When several subfeatures overlap the cursor on one row —
// the repeat_region case, where LTRs/TSDs are painted over the internal
// retrotransposon body (see processRepeatRegionLayout) — the one painted last
// is on top. subfeatureInfos is populated in paint order and the Flatbush index
// preserves that order, so the largest matching index is the topmost subfeature.
// Pick it so the hover/tooltip matches what's actually drawn under the cursor.
function topmostMatch(indices: number[]) {
  let top: number | undefined
  for (const i of indices) {
    if (top === undefined || i > top) {
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
// subfeature of an overlapping neighbor from being paired with `feature`.
function resolveSubfeature(
  data: FeatureDataResult,
  indexes: FlatbushRegionIndexes,
  bpPos: number,
  yPos: number,
  feature: FlatbushItem,
): SubfeatureInfo | null {
  if (indexes.subfeature) {
    const idx = topmostMatch(
      indexes.subfeature.search(bpPos, yPos, bpPos, yPos),
    )
    if (idx !== undefined) {
      const candidate = data.subfeatureInfos[idx]!
      if (candidate.parentFeatureId === feature.featureId) {
        return candidate
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

        if (indexes.feature) {
          // Features' hit boxes are padded by label width and can overlap a
          // neighbor's box, so pick the topmost (last-painted = largest index)
          // rather than whatever Flatbush yields first.
          const idx = topmostMatch(
            indexes.feature.search(bpPos, yPos, bpPos, yPos),
          )
          if (idx !== undefined) {
            const feature = data.flatbushItems[idx]!
            return {
              feature,
              // Resolve the topmost subfeature the same way, but only keep it
              // when it belongs to the chosen feature. The two indexes search
              // independently and the feature boxes are widened by pad/label
              // overhang while the subfeature index is not, so in the overlap
              // of two same-row features an ungated subfeature could pair with
              // the other feature — showing its isoform tooltip while select
              // acts on this one.
              subfeature: resolveSubfeature(
                data,
                indexes,
                bpPos,
                yPos,
                feature,
              ),
              peptide: findPeptideAt(data, bpPos, yPos, idx),
              bpPos,
              bpPerPx: bpSpan / blockWidth,
              displayedRegionIndex: vr.displayedRegionIndex,
            }
          }
        }
      }
    }
  }
  return { feature: null, subfeature: null }
}
