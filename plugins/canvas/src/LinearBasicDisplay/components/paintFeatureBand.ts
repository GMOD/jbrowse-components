import { drawFeatureBlocks } from './Canvas2DFeatureRenderer.ts'
import { forEachDisplayLabel, labelCullBand } from './labelPositioning.ts'
import { paintLabels } from './paintLabels.ts'

import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureRenderBlock } from './canvasFeatureRenderingBackendTypes.ts'
import type { RegionWithData } from './labelPositioning.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface FeatureBandPaint {
  canvasWidth: number
  bandHeight: number
  // The label kinds the fit ladder actually KEPT, never the ones the mode asked
  // for: the boxes below reserve exactly the overhang these two flags leave on,
  // and a hit index built beside this pass has to be told the same pair.
  showLabels: boolean
  showDescriptions: boolean
  fontSize: number
}

/**
 * Paint a laid-out feature stack as a band on somebody else's canvas: the
 * geometry, then the labels the layout reserved room for.
 *
 * This display draws those two halves through different mechanisms — a canvas
 * for the glyphs, a DOM layer for the labels — and bakes them into two
 * `PaintLayer`s in its SVG export, where a scroll offset, the highlight boxes
 * and the peptide letters interleave. A band has none of that: it does not
 * scroll, it is too short for a label layer's chrome, and it is one strip of a
 * display that owns the rest of the canvas. So the band's own composition lives
 * here, stated once, and both of a consumer's paths — the on-screen canvas and
 * its SVG export — run it rather than each spelling the pair.
 *
 * The order and the shared arguments are the whole point. `fontSize` letters the
 * text at the width the packer measured, the cull band is the band itself
 * (nothing scrolls out of view, so anything outside it is outside the strip),
 * and the labels go on after the geometry because that is the on-screen stacking
 * order. An export that re-derived any of the three drew a picture the reader
 * never saw.
 *
 * No subfeature labels: a band is one flat row of records, so a consumer's
 * config sets `subfeatureLabels: 'none'` and nothing bakes one. A band that
 * wants them parameterizes this, and gets a compile error at its call site
 * rather than a silently dropped label.
 */
export function paintFeatureBand(
  ctx: Ctx2D,
  dataMap: ReadonlyMap<number, FeatureDataResult>,
  blocks: FeatureRenderBlock[],
  regions: RegionWithData[],
  {
    canvasWidth,
    bandHeight,
    showLabels,
    showDescriptions,
    fontSize,
  }: FeatureBandPaint,
) {
  drawFeatureBlocks(ctx, dataMap, blocks, {
    scrollY: 0,
    canvasWidth,
    canvasHeight: bandHeight,
  })
  forEachDisplayLabel(
    regions,
    dataMap,
    { showLabels, showDescriptions, showSubfeatureLabels: false, fontSize },
    (_, labels) => {
      paintLabels(ctx, labels, fontSize)
    },
    labelCullBand(0, bandHeight),
  )
}
