import { SimpleFeature } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import {
  GENE_GLYPH_DEFAULTS,
  buildFeatureRenderData,
  layoutRegionKey,
} from '@jbrowse/plugin-features/band'

import { carrierPercent } from './recordCarriers.ts'

import type { VariantFeatureInfo } from '../shared/types.ts'
import type { RecordCarriers } from './recordCarriers.ts'
import type { Feature } from '@jbrowse/core/util'
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
 * literal, because a band has no config node of its own. A record has no
 * subfeatures, so `findGlyph` lands on `layoutBox` and the gene half is inert.
 *
 * Each record carries its `recordColor` and its one-line `recordLabel`, name,
 * description and carrier percent, so neither costs a label row. `filter` is empty
 * because the worker's `configuredFilters()` already admitted these records.
 */
export function recordsDisplayConfig(featureHeight: number): DisplayConfig {
  return {
    color: { value: `jexl:get(feature,'recordColor')`, field: '' },
    featureHeight,
    labels: { name: `jexl:get(feature,'recordLabel')`, description: '' },
    tooltip: '',
    filter: [],
    ...GENE_GLYPH_DEFAULTS,
    geneGlyphMode: 'all',
  }
}

function labelOf(labels: RecordsLabels, jexl: JexlInstance) {
  const readers = [labels.name, labels.description]
    .filter(field => field !== '')
    .map(field => fieldReader(field, jexl))
  return (feature: Feature) =>
    readers
      .map(read => valueText(read(feature)))
      .filter(text => text !== '')
      .join(' ')
}

/**
 * The band's records as plugin-features render data, rebuilt from the cell
 * payload, which already holds each record's span, ID, description, SV class
 * and resolved color: the band costs no RPC, and `records.show` stays a
 * render-tier setting. The band is the structural variants: a record with no
 * SV class (an SNV, a small indel) is left out.
 */
export function buildRecordsRenderData({
  data,
  region,
  labels,
  carriers,
  config,
  jexl,
}: {
  data: RecordsSourceData
  region: RecordsRegion
  labels: RecordsLabels
  carriers: ReadonlyMap<string, RecordCarriers>
  config: DisplayConfig
  jexl: JexlInstance
}): LayoutRegionData {
  const { featureInfo, featurePositions, featureColors } = data
  const label = labelOf(labels, jexl)
  const recordFeature = (info: VariantFeatureInfo, f: number) => {
    const record = {
      uniqueId: info.featureId,
      refName: region.refName,
      start: featurePositions[f * 2]!,
      end: featurePositions[f * 2 + 1]!,
      name: info.name,
      description: info.description,
      type: info.type,
      recordColor: abgrToCssRgba(featureColors[f]!),
    }
    const text = label(new SimpleFeature(record))
    const counted = carriers.get(info.featureId)
    const percent = counted ? carrierPercent(counted) : ''
    return new SimpleFeature({
      ...record,
      recordLabel: text && percent ? `${text} ${percent}` : text,
    })
  }
  const features = featureInfo.flatMap((info, f) =>
    info.svType === '' ? [] : [recordFeature(info, f)],
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
