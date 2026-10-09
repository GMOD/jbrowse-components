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
 * The indices of the records worth laying out at this zoom, in payload order,
 * or undefined when every record is.
 *
 * A record no wider than `binBp` shares its pixel with its neighbours, and an
 * opaque mark there shows only the last one drawn. So the lane keeps the last
 * record of each (bin, color) among those and every wider record, which paints
 * the pixels the full set would and bounds the work by the band's width rather
 * than the window's record count. A bin is genomic, so a pan keeps the same
 * survivors.
 */
export function laneRecordsAtZoom(
  data: Pick<LaneSourceData, 'featurePositions' | 'featureColors'>,
  binBp: number,
) {
  if (binBp <= 1) {
    return undefined
  }
  const { featurePositions, featureColors } = data
  const binsByColor = new Map<number, Set<number>>()
  const kept: number[] = []
  for (let f = featureColors.length - 1; f >= 0; f--) {
    const start = featurePositions[f * 2]!
    if (featurePositions[f * 2 + 1]! - start > binBp) {
      kept.push(f)
    } else {
      const color = featureColors[f]!
      let bins = binsByColor.get(color)
      if (!bins) {
        bins = new Set()
        binsByColor.set(color, bins)
      }
      const bin = Math.floor(start / binBp)
      if (!bins.has(bin)) {
        bins.add(bin)
        kept.push(f)
      }
    }
  }
  return kept.length === featureColors.length ? undefined : kept.reverse()
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
  binBp = 1,
}: {
  data: LaneSourceData
  region: LaneRegion
  config: DisplayConfig
  jexl: JexlInstance
  binBp?: number
}): LayoutRegionData {
  const { featureInfo, featurePositions, featureColors } = data
  const indices =
    laneRecordsAtZoom(data, binBp) ?? Array.from(featureInfo.keys())
  const features = indices.map(f => {
    const info = featureInfo[f]!
    return new SimpleFeature({
      uniqueId: info.featureId,
      refName: region.refName,
      start: featurePositions[f * 2]!,
      end: featurePositions[f * 2 + 1]!,
      name: info.name,
      description: info.description,
      type: info.type,
      laneColor: abgrToCssRgba(featureColors[f]!),
    })
  })
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
