import { bodyHeightPx } from './layoutInputs.ts'
import { isPlacedRow } from './rowPlacement.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

// The passes that WRITE a laid-out region: the clone the writers own, the
// display-mode height scale, the post-pack fit scale, and the pass that adds
// each feature's packed row offset. Everything here mutates the clone
// `cloneMutableFields` makes and nothing here decides a row — the same shape as
// the `apply*` halves of isoformTrim.ts and isoformGapFloor.ts, which run in the
// same per-region sequence.

function scaleFloat32(arr: Float32Array, multiplier: number) {
  for (let i = 0; i < arr.length; i++) {
    arr[i]! *= multiplier
  }
}

// Scales a Y array by the compact multiplier and then spends each element's
// `below` label rows at the mode's own label font size. Two units, because the
// worker emits geometry in normal-mode px (scaled by `multiplier`) but counts
// label rows (see FeatureLayout.labelRowsAbove) — their height is `labelFontPx`,
// which shrinks on the gentler LABEL_FONT_MULTIPLIERS and so cannot ride the
// geometry scale. `rows` is length-zero whenever the region has no below-labels,
// which is the ordinary case and costs nothing here.
function scaleYWithLabelRows(
  ys: Float32Array,
  rows: Uint8Array,
  multiplier: number,
  labelFontPx: number,
) {
  const hasRows = rows.length > 0
  for (let i = 0; i < ys.length; i++) {
    ys[i] = ys[i]! * multiplier + (hasRows ? rows[i]! * labelFontPx : 0)
  }
}

// Scales all height/y fields in a cloned FeatureDataResult by the compact
// multiplier, and spends the worker's counted `below` label rows at the mode's
// label font size. Worker geometry is always in normal-mode units; this makes
// compact/superCompact a pure main-thread operation.
//
// No `multiplier === 1` early return: normal mode still has label rows to spend
// (the worker leaves the Y gap-free in EVERY mode), so the pass is uniform
// across modes rather than special-cased for one.
export function applyHeightScale(
  data: FeatureDataResult,
  multiplier: number,
  labelFontPx: number,
) {
  for (const kind of ['rect', 'line', 'arrow'] as const) {
    scaleYWithLabelRows(
      data[`${kind}Ys`],
      data[`${kind}LabelRows`],
      multiplier,
      labelFontPx,
    )
    scaleFloat32(data[`${kind}Heights`], multiplier)
  }
  for (const item of data.flatbushItems) {
    // a gene's own extent has to cover every label row it contains, which is
    // what keeps the hit box in step with the row the packer gave it
    item.featureHeightPx = bodyHeightPx(
      item.featureHeightPx,
      item.labelRows,
      multiplier,
      labelFontPx,
    )
  }
  for (const info of data.subfeatureInfos) {
    const above = (info.labelRowsAbove ?? 0) * labelFontPx
    info.topPx = info.topPx * multiplier + above
    // a transcript's own label row sits under its body, so its hit box covers it
    info.bottomPx =
      info.bottomPx * multiplier + above + (info.ownsLabelRow ? labelFontPx : 0)
  }
  for (const labelData of data.floatingLabelsData.values()) {
    labelData.topY =
      labelData.topY * multiplier +
      (labelData.labelRowsAbove ?? 0) * labelFontPx
    // same term the flatbush loop above applies, and for the same reason: the
    // name label hangs off this height
    labelData.featureHeight =
      labelData.featureHeight * multiplier +
      (labelData.labelRows ?? 0) * labelFontPx
  }
  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx = aa.topPx * multiplier + (aa.labelRowsAbove ?? 0) * labelFontPx
      // heightPx drives the peptide letter font size and vertical centering
      // (peptidePositioning.ts) and the codon hit box (hitTesting.ts); scale it
      // with topPx so letters stay sized to and centered on the shrunken codon
      // rect (whose height is scaled via rectHeights) in compact mode.
      aa.heightPx *= multiplier
    }
  }
}

// Fit-to-display-height: uniformly scale an already-laid-out region so the whole
// stack fits the track height without scrolling. Unlike applyHeightScale (a
// pre-pack body shrink that feeds the packer), this runs AFTER packing, so it
// also scales the packed `topPx`/`bottomPx` and the row-offset Ys — every Y and
// height by the same factor, so content height × scale lands exactly on the track
// height. Row assignment is untouched (it's fixed by X-overlap), so it's a pure
// vertical shrink that keeps the stack top-anchored at y=0.
export function scaleLaidOutData(
  map: ReadonlyMap<number, FeatureDataResult>,
  scale: number,
): Map<number, FeatureDataResult> {
  const out = new Map<number, FeatureDataResult>()
  for (const [n, data] of map) {
    if (data.flatbushItems.length === 0) {
      // Nothing to scale — share the raw object (as computeLaidOutData does for
      // empty regions) rather than allocating clone arrays that stay untouched,
      // keeping the reference stable so idle empty regions don't re-upload.
      out.set(n, data)
    } else {
      const cloned = cloneMutableFields(data)
      // Reuse applyHeightScale for the fields it already covers (rect/line/arrow
      // Ys+heights, subfeature/label/amino-acid tops, featureHeightPx), then add
      // the packed flatbush box tops/bottoms it doesn't touch (those are 0 at the
      // pre-pack stage applyHeightScale was written for).
      // labelFontPx 0: the label rows were already spent when this layout was
      // committed (layoutRefGroups), so they are part of the Y values being
      // scaled here and must not be added a second time. Scaling them with
      // everything else is right in both directions — above 1 it only
      // over-reserves, and below 1 nothing is left drawing in them (the `bodies`
      // rung is the only one that squeezes, and it hides names, descriptions and
      // — via `renderedShowSubfeatureLabels` — subfeature labels too).
      applyHeightScale(cloned, scale, 0)
      for (const item of cloned.flatbushItems) {
        item.topPx *= scale
        item.bottomPx *= scale
      }
      out.set(n, cloned)
    }
  }
  return out
}

export function cloneMutableFields(raw: FeatureDataResult) {
  const floatingLabelsData = new Map<string, FeatureLabelData>()
  for (const [k, v] of raw.floatingLabelsData) {
    floatingLabelsData.set(k, { ...v })
  }
  return {
    ...raw,
    rectYs: new Float32Array(raw.rectYs),
    rectHeights: new Float32Array(raw.rectHeights),
    // Cloned because applyLayoutToRegion narrows it from the worker's
    // fade-eligibility flag to the actual density-collapse decision.
    rectDensityFade: new Uint32Array(raw.rectDensityFade),
    lineYs: new Float32Array(raw.lineYs),
    lineHeights: new Float32Array(raw.lineHeights),
    arrowYs: new Float32Array(raw.arrowYs),
    arrowHeights: new Float32Array(raw.arrowHeights),
    flatbushItems: raw.flatbushItems.map(item => ({ ...item })),
    subfeatureInfos: raw.subfeatureInfos.map(info => ({ ...info })),
    floatingLabelsData,
    aminoAcidOverlay: raw.aminoAcidOverlay?.map(aa => ({ ...aa })),
  }
}

// Mutates the cloned region in place. Raw data has topPx=0 everywhere, so we
// simply add the per-feature offset rather than computing a delta from the
// previous layout. Callers must pass the clone produced by cloneMutableFields.
export function applyLayoutToRegion(
  data: FeatureDataResult,
  layoutMap: Map<string, number>,
  layoutHeights: Map<string, number>,
  // Feature ids whose name was decimated away: their floatingLabelsData entry is
  // deleted below so no renderer/hit-test draws a name the packer didn't reserve.
  droppedLabelIds: ReadonlySet<string>,
  // Feature ids drawn over by PILEUP_FADE_DEPTH marks sharing their row. Only
  // these keep the fade flag the worker set; every other box is rewritten to 0
  // and drawn opaque.
  densityFadeIds: ReadonlySet<string>,
) {
  const featureOffsets = new Float32Array(data.flatbushItems.length)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    featureOffsets[i] = layoutMap.get(data.flatbushItems[i]!.featureId)!
  }

  for (let i = 0; i < data.rectDensityFade.length; i++) {
    const featureId = data.flatbushItems[data.rectFeatureIndices[i]!]!.featureId
    data.rectDensityFade[i] = densityFadeIds.has(featureId) ? 1 : 0
  }

  for (const kind of ['rect', 'line', 'arrow'] as const) {
    const ys = data[`${kind}Ys`]
    const featureIndices = data[`${kind}FeatureIndices`]
    for (let i = 0; i < ys.length; i++) {
      ys[i] = ys[i]! + featureOffsets[featureIndices[i]!]!
    }
  }

  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    const offset = featureOffsets[i]!
    const height = layoutHeights.get(item.featureId)!
    item.topPx = offset
    item.bottomPx = offset + height
  }

  for (const info of data.subfeatureInfos) {
    const offset = layoutMap.get(info.parentFeatureId) ?? 0
    info.topPx += offset
    info.bottomPx += offset
  }

  // Drop the whole entry for a feature the packer could not place (see the row
  // limit at `addRect`): the feature itself doesn't render, and we don't want to
  // pay the React reconciliation cost of emitting thousands of off-screen <div>
  // labels in FloatingLabelsLayer.
  //
  // A decimated feature keeps its entry and loses only `nameLabel` — that is the
  // one label the decimation ruled on, and it's the one whose row height went
  // unreserved, so drawing it would overlap the boxes. Its description and
  // subfeature label still have reserved space and still draw.
  for (const [key, labelData] of data.floatingLabelsData) {
    const layoutKey = labelData.parentFeatureId ?? labelData.featureId
    const offset = layoutMap.get(layoutKey)
    if (offset === undefined || !isPlacedRow(offset)) {
      data.floatingLabelsData.delete(key)
      continue
    }
    if (droppedLabelIds.has(layoutKey)) {
      delete labelData.nameLabel
    }
    labelData.topY += offset
  }

  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += featureOffsets[aa.flatbushIdx]!
    }
  }
}
