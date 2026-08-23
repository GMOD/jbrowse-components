import { SimpleFeature } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { buildFeatureRenderData } from '@jbrowse/plugin-canvas'

import type { VariantFeatureInfo } from '../shared/types.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { DisplayConfig, LayoutRegionData } from '@jbrowse/plugin-canvas'

/**
 * The per-region fields the lane reads off the display's payload. Everything
 * here is per **feature** — one entry per record, never per genotype — so a
 * 2504-sample callset costs the lane exactly what a 1-sample one does.
 */
export interface LaneSourceData {
  featurePositions: Uint32Array
  featureColors: Uint32Array
  featureIdList: string[]
  featureGenotypeMap: Record<string, VariantFeatureInfo>
}

/** The region bounds the lane lays a block out in. */
export interface LaneRegion {
  displayedRegionIndex: number
  refName: string
  start: number
  end: number
}

/**
 * The lane's marks, as `plugin-canvas` render data.
 *
 * This is the whole reason the lane is not its own painter any more. The band
 * wants what a `LinearVariantDisplay` gives — boxes packed so overlapping SVs
 * stack instead of overdrawing, labels placed by layout, one paint order that
 * the hit test agrees with — and every one of those is a decision
 * `plugin-canvas` has already made. So the lane stops making them and hands its
 * records to `buildFeatureRenderData` instead, exactly as that plugin's own RPC
 * does with the features it fetched.
 *
 * **Main thread, and no second fetch.** The variants worker already parsed these
 * records (it read every genotype off them), and everything a variant *record*
 * is already rides in the payload — span in `featurePositions`, ID and
 * description and SO type in `featureGenotypeMap`, resolved color in
 * `featureColors`. So the features are rebuilt here from bytes already on the
 * wire: no extra RPC, no extra payload, and `showVariantLane` stays a
 * render-tier setting that a toggle or a band resize must not refetch. The pass
 * is per record (thousands), not per cell (millions), and it is memoized on the
 * model beside the packer — which `plugin-canvas` also runs main-thread.
 *
 * A rebuilt feature is deliberately thin: a variant's glyph is `layoutBox`, one
 * rect with no subfeatures, so the layout reads a span, a height and a color and
 * nothing else. `laneColor` is how the color gets in — the lane's `color` slot is
 * a jexl reading exactly that attribute (see `laneDisplayConfig`), which is the
 * ordinary per-feature-color path and keeps a mark the same color as the alt
 * cells in the column under it. `REF`/`ALT` ride along for the `mouseover` slot.
 */
export function buildLaneRenderData({
  data,
  region,
  config,
  palette,
  jexl,
}: {
  data: LaneSourceData
  region: LaneRegion
  config: DisplayConfig
  palette: JBrowsePalette
  jexl: JexlInstance
}): LayoutRegionData {
  const { featureIdList, featurePositions, featureColors, featureGenotypeMap } =
    data
  const features = featureIdList.map((featureId, f) => {
    const info = featureGenotypeMap[featureId]
    return new SimpleFeature({
      uniqueId: featureId,
      refName: region.refName,
      start: featurePositions[f * 2]!,
      end: featurePositions[f * 2 + 1]!,
      name: info?.name,
      description: info?.description,
      type: info?.type,
      laneColor: abgrToCssRgba(featureColors[f]!),
      REF: info?.ref,
      ALT: info?.alt,
    })
  })
  return {
    ...buildFeatureRenderData({
      features,
      featureCount: features.length,
      config,
      palette,
      jexl,
      regionStart: region.start,
      regionEnd: region.end,
    }),
    // What `computeLaidOutData` groups regions by, so two blocks of one
    // chromosome pack against each other rather than each from row 0.
    regionKey: region.refName,
  }
}
