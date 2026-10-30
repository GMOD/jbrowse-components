import { SimpleFeature } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  GENE_GLYPH_DEFAULTS,
  buildFeatureRenderData,
  layoutRegionKey,
} from '@jbrowse/plugin-features/band'

import type { VariantFeatureInfo } from '../shared/types.ts'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type {
  DisplayConfig,
  LayoutRegionData,
} from '@jbrowse/plugin-features/band'

/**
 * The per-region fields the records band reads off the cell payload, one entry
 * per record and never per genotype, so a 3202-sample callset costs the band
 * what a 1-sample one does.
 */
export interface RecordsSourceData {
  featurePositions: Uint32Array
  featureColors: Uint32Array
  featureInfo: VariantFeatureInfo[]
}

/**
 * The field each label kind reads off a record, empty where `records.labels`
 * hides it.
 */
export interface RecordsLabels {
  name: string
  description: string
}

interface RecordsRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

/**
 * The plugin-features display config the band lays its records out with. A
 * literal, because a band has no config node of its own: the slots that matter
 * are this display's (`records.labels`, the cell color). A record has no
 * subfeatures, so `findGlyph` lands on `layoutBox` and the gene half is inert.
 *
 * `color` reads the `recordColor` each rebuilt feature carries, the color the
 * display resolved for its alt cells, alpha included, which the BED `itemRgb`
 * path would drop. `filter` is empty because the worker's `configuredFilters()`
 * already admitted these records.
 */
export function recordsDisplayConfig({
  labels,
  featureHeight,
}: {
  labels: RecordsLabels
  featureHeight: number
}): DisplayConfig {
  return {
    color: { value: `jexl:get(feature,'recordColor')`, field: '' },
    featureHeight,
    labels,
    tooltip: '',
    filter: [],
    ...GENE_GLYPH_DEFAULTS,
    geneGlyphMode: 'all',
  }
}

/**
 * The band's records as plugin-features render data, rebuilt from the cell
 * payload, which already holds each record's span, ID, description, SO type and
 * resolved color: the band costs no RPC, and `records.show` stays a
 * render-tier setting.
 */
export function buildRecordsRenderData({
  data,
  region,
  config,
  jexl,
}: {
  data: RecordsSourceData
  region: RecordsRegion
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
        recordColor: abgrToCssRgba(featureColors[f]!),
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
    regionKey: layoutRegionKey(region),
    regionStart: region.start,
    regionEnd: region.end,
  }
}
