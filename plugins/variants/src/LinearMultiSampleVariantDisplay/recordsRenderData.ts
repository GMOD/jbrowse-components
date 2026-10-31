import { SimpleFeature } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import {
  DEFAULT_TOOLTIP,
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
 * The one-line label a record carries over genotype rows: name, description
 * and carrier percent as `recordLabel`, so neither costs a label row.
 */
export const RECORD_LABEL_LINE: RecordsLabels = {
  name: `jexl:get(feature,'recordLabel')`,
  description: '',
}

// The fields a record carries from the worker's reads (`RecordFieldReads`)
const RECORD_TOOLTIP_FIELD = 'recordTooltip'
const RECORD_GROUP_FIELD = 'recordGroup'

/**
 * The plugin-features display config the band lays its records out with. A
 * literal, because a band has no config node of its own. A record has no
 * subfeatures, so `findGlyph` lands on `layoutBox` and the gene half is inert.
 *
 * Each record carries its `recordColor`; `labels` is `RECORD_LABEL_LINE` over
 * rows, and with no rows the display's own label fields, laid out as a
 * feature track lays them. `filter` is empty because the worker's
 * `configuredFilters()` already admitted these records. `tooltip` is the
 * field the worker read for the tooltip line, `''` for the default, which
 * reads the record's name as a feature track's does; a faceted band stamps
 * each record's section off the value the worker read for it.
 */
export function recordsDisplayConfig({
  featureHeight,
  labels,
  tooltip,
  faceted,
}: {
  featureHeight: number
  labels: RecordsLabels
  tooltip: string
  faceted: boolean
}): DisplayConfig {
  return {
    color: { value: `jexl:get(feature,'recordColor')`, field: '' },
    featureHeight,
    labels,
    tooltip: tooltip === '' ? DEFAULT_TOOLTIP : RECORD_TOOLTIP_FIELD,
    ...(faceted ? { facetField: RECORD_GROUP_FIELD } : {}),
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
 * Each drawn record's span under its region's layout key, the shape
 * `featureIdsTouchingBlocks` counts on-screen records from. Read off the
 * payload, not the render data, whose labels depend on that count.
 */
export function recordSpans({
  data,
  region,
  svOnly,
}: {
  data: Pick<RecordsSourceData, 'featurePositions' | 'featureInfo'>
  region: RecordsRegion
  svOnly: boolean
}) {
  const { featureInfo, featurePositions } = data
  return {
    regionKey: layoutRegionKey(region),
    flatbushItems: featureInfo.flatMap((info, f) =>
      svOnly && info.svType === ''
        ? []
        : [
            {
              featureId: info.featureId,
              startBp: featurePositions[f * 2]!,
              endBp: featurePositions[f * 2 + 1]!,
            },
          ],
    ),
  }
}

/**
 * The band's records as plugin-features render data, rebuilt from the cell
 * payload, which already holds each record's span, ID, description, SV class
 * and resolved color: the band costs no RPC, and `records.show` stays a
 * render-tier setting. Over genotype rows (`svOnly`) the band is the
 * structural variants, a record with no SV class (an SNV, a small indel) left
 * out; with no rows drawn it is every record the display's filter admitted.
 */
export function buildRecordsRenderData({
  data,
  region,
  labels,
  carriers,
  svOnly,
  config,
  jexl,
}: {
  data: RecordsSourceData
  region: RecordsRegion
  labels: RecordsLabels
  carriers: ReadonlyMap<string, RecordCarriers>
  svOnly: boolean
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
      [RECORD_TOOLTIP_FIELD]: info.tooltip,
      [RECORD_GROUP_FIELD]: info.groupKey,
      recordLabel: '',
    }
    // one feature per record, holding `record` itself: the label is read off
    // it and written back before anything else sees it
    const feature = new SimpleFeature(record)
    const text = label(feature)
    const counted = carriers.get(info.featureId)
    const percent = counted ? carrierPercent(counted) : ''
    record.recordLabel = text && percent ? `${text} ${percent}` : text
    return feature
  }
  const features = featureInfo.flatMap((info, f) =>
    svOnly && info.svType === '' ? [] : [recordFeature(info, f)],
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
