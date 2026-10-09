import { SimpleFeature } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { buildFeatureRenderData, layoutRegionKey } from '@jbrowse/plugin-canvas'

import type { VariantFeatureInfo } from '../shared/types.ts'
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
  featureInfo: VariantFeatureInfo[]
}

/** The region bounds the lane lays a block out in. */
interface LaneRegion {
  displayedRegionIndex: number
  assemblyName: string
  refName: string
  start: number
  end: number
}

/**
 * The lane's marks, as `plugin-canvas` render data.
 *
 * The records come from the cell payload, which already holds each one's span,
 * ID, description, SO type and resolved color, so the band costs no RPC and
 * `showVariantLane` stays a render-tier setting. The packer, the fit ladder, the
 * painter and the hit test are plugin-canvas's own, which is what keeps the
 * band and a `LinearVariantDisplay` from drifting apart.
 *
 * A rebuilt feature is thin: a variant's glyph is `layoutBox`, one rect with no
 * subfeatures. `laneColor` carries the display's color in, and the lane's
 * `color` slot is a jexl reading it (`laneDisplayConfig`).
 */
export function buildLaneRenderData({
  data,
  region,
  config,
  jexl,
}: {
  data: LaneSourceData
  region: LaneRegion
  config: DisplayConfig
  jexl: JexlInstance
}): LayoutRegionData {
  const { featureInfo, featurePositions, featureColors } = data
  const features = featureInfo.map(
    (info, f) =>
      new SimpleFeature({
        uniqueId: info.featureId,
        refName: region.refName,
        start: featurePositions[f * 2]!,
        end: featurePositions[f * 2 + 1]!,
        name: info.name,
        description: info.description,
        type: info.type,
        laneColor: abgrToCssRgba(featureColors[f]!),
      }),
  )
  return {
    ...buildFeatureRenderData({
      features,
      config,
      jexl,
      regionStart: region.start,
      regionEnd: region.end,
    }),
    // two blocks of one chromosome pack against each other
    regionKey: layoutRegionKey(region),
  }
}
