import { isCallbackValue, readConfigValue } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { cssColorToABGR, featureBedColor } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import {
  MAX_LEGEND_CANDIDATES,
  createLegendCandidateCollector,
} from '@jbrowse/core/util/legendCandidates'

import type { WorkerColor } from '../RenderFeatureDataRPC/renderConfig.ts'
import type {
  MultiRowColorValues,
  MultiRowGetFeaturesResult,
  MultiRowRegionData,
  PartitionCandidateValues,
} from './rpcTypes.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

function evalColorSlot(
  colorCfg: { color: string },
  feature: Feature,
  jexl: JexlInstance,
) {
  try {
    const css = readConfigValue(colorCfg, 'color', feature, jexl)
    return typeof css === 'string' ? css : featureDefaultColor
  } catch {
    return featureDefaultColor
  }
}

export function makeFeatureColorResolver(
  colorConfig: string | undefined,
  jexl: JexlInstance,
) {
  if (colorConfig === undefined) {
    const fallback = { css: featureDefaultColor, fromBed: false }
    return (feature: Feature) => {
      const bedColor = featureBedColor(feature)
      return bedColor === undefined
        ? fallback
        : { css: bedColor, fromBed: true }
    }
  } else if (isCallbackValue(colorConfig)) {
    const colorCfg = { color: colorConfig }
    return (feature: Feature) => ({
      css: evalColorSlot(colorCfg, feature, jexl),
      fromBed: false,
    })
  } else {
    const constant = { css: colorConfig, fromBed: false }
    return () => constant
  }
}

// A numeric BED column is a real row name, so coerce rather than trust the
// declared type; an absent one stays '', which the row axis and the legend both
// read as naming nothing.
function columnValue(raw: unknown) {
  return raw === undefined || raw === null ? '' : String(raw)
}

export function collectLegendCandidates({
  featureNames,
  featureColors,
  featurePartitionIndex,
}: Pick<
  MultiRowRegionData,
  'featureNames' | 'featureColors' | 'featurePartitionIndex'
>) {
  const collector = createLegendCandidateCollector()
  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i]!
    if (name !== '') {
      collector.add(featurePartitionIndex[i]!, name, featureColors[i]!)
    }
  }
  return collector.candidates
}

const NON_PARTITION_TAGS = new Set([
  'start',
  'end',
  'refName',
  'uniqueId',
  'subfeatures',
  'parentId',
  'strand',
  'score',
  'phase',
  'source',
])

const PARTITION_CANDIDATE_SAMPLE = 20

/**
 * Enumerates attributes through `toJSON`, not `tags()`: `tags` is
 * `SimpleFeature`'s, and the `Feature` interface an adapter may implement
 * carries only the serializer.
 */
function collectPartitionCandidates(features: Feature[]) {
  const names = new Set<string>()
  const n = Math.min(features.length, PARTITION_CANDIDATE_SAMPLE)
  for (let i = 0; i < n; i++) {
    for (const tag of Object.keys(features[i]!.toJSON())) {
      if (!NON_PARTITION_TAGS.has(tag)) {
        names.add(tag)
      }
    }
  }
  return [...names].sort()
}

export const MAX_COUNTED_PARTITION_VALUES = 200

// Truncating makes the count approximate: two values sharing this prefix
// undercount by one.
export const MAX_PARTITION_VALUE_LENGTH = 64

export const PARTITION_VALUE_COUNT_SAMPLE = 5_000

/**
 * Collects values rather than counts because regions land independently and the
 * main thread unions them, and a count cannot be unioned.
 */
function createCandidateValueCounter(candidates: string[]) {
  const active = new Map(candidates.map(c => [c, new Set<string>()]))
  const overflowed = new Set<string>()
  return {
    add(feature: Feature) {
      for (const [field, values] of active) {
        values.add(
          columnValue(feature.get(field)).slice(0, MAX_PARTITION_VALUE_LENGTH),
        )
        if (values.size > MAX_COUNTED_PARTITION_VALUES) {
          active.delete(field)
          overflowed.add(field)
        }
      }
    },
    result(): PartitionCandidateValues[] {
      return candidates.map(field => {
        const overflow = overflowed.has(field)
        return {
          field,
          values: overflow ? [] : [...active.get(field)!],
          overflow,
        }
      })
    },
  }
}

// The colour field's value per feature, the main thread's to paint: each
// feature's one-based index into `values`, and each value with the partition
// row it lands in.
function createColorValueCollector(field: string, jexl: JexlInstance) {
  const read = fieldReader(field, jexl)
  const values: string[] = []
  const indexOfText = new Map<string, number>()
  const painted: MultiRowColorValues['painted'] = []
  const paintedIds = new Set<string>()
  return {
    colorValues: { field, values, painted },
    laneValueOf(feature: Feature, rowIndex: number) {
      const text = valueText(read(feature))
      let index = indexOfText.get(text)
      if (index === undefined) {
        index = values.length
        values.push(text)
        indexOfText.set(text, index)
      }
      const id = `${rowIndex}:${index}`
      if (painted.length < MAX_LEGEND_CANDIDATES && !paintedIds.has(id)) {
        paintedIds.add(id)
        painted.push({ rowIndex, valueIndex: index })
      }
      return index + 1
    },
  }
}

export const AUTO_PARTITION_FIELD = ''

const PREFERRED_PARTITION_FIELDS = ['repClass']

const FALLBACK_PARTITION_FIELD = 'name'

/**
 * Only the worker knows which columns the data carries, so it picks the field
 * and reports it back as `resolvedPartitionField` — clustering has to ask for
 * the same one to land each feature in the row the painting drew it in.
 */
export function resolvePartitionField(
  partitionField: string,
  partitionCandidates: string[],
) {
  const preferred = PREFERRED_PARTITION_FIELDS.find(f =>
    partitionCandidates.includes(f),
  )
  return partitionField === AUTO_PARTITION_FIELD
    ? preferred === undefined
      ? FALLBACK_PARTITION_FIELD
      : preferred
    : partitionField
}

/**
 * Reads one feature attribute, or derives it from a `jexl:` expression. Both
 * the row a feature paints in and the value it clusters on come through here —
 * were the two to drift, the cluster order would describe rows the painting
 * never drew.
 */
export function makeFeatureValueResolver(field: string, jexl: JexlInstance) {
  if (!isCallbackValue(field)) {
    return (feature: Feature) => columnValue(feature.get(field))
  }
  const cfg = { field }
  return (feature: Feature) => {
    try {
      return columnValue(readConfigValue(cfg, 'field', feature, jexl))
    } catch {
      return ''
    }
  }
}

export function packMultiRowFeatures({
  features,
  partitionField,
  lengthField,
  colorConfig,
  jexl,
  report,
}: {
  features: Feature[]
  partitionField: string
  lengthField: string
  colorConfig: WorkerColor
  jexl: JexlInstance
  report?: ProgressReporter
}): MultiRowGetFeaturesResult {
  const n = features.length
  const featureStarts = new Uint32Array(n)
  const featureEnds = new Uint32Array(n)
  const featureColors = new Uint32Array(n)
  const featurePartitionIndex = new Uint32Array(n)
  const packDeltas = lengthField !== ''
  const featureDeltas = new Int32Array(packDeltas ? n : 0)
  const featureNames: string[] = new Array(n)
  const featureIds: string[] = new Array(n)
  const partitionValues: string[] = []
  const valueIndex = new Map<string, number>()
  const featureColor = makeFeatureColorResolver(colorConfig.value, jexl)
  const colorValues = colorConfig.field
    ? createColorValueCollector(colorConfig.field, jexl)
    : undefined
  const featureColorValues = new Uint32Array(colorValues ? n : 0)
  const partitionCandidates = collectPartitionCandidates(features)
  const resolvedPartitionField = resolvePartitionField(
    partitionField,
    partitionCandidates,
  )
  const candidateValues = createCandidateValueCounter(partitionCandidates)
  const featurePartition = makeFeatureValueResolver(
    resolvedPartitionField,
    jexl,
  )
  let usedItemRgb = false

  for (let i = 0; i < n; i++) {
    report?.(i)
    const feature = features[i]!
    featureStarts[i] = feature.get('start')
    featureEnds[i] = feature.get('end')
    featureIds[i] = feature.id()
    const name: unknown = feature.get('name')
    featureNames[i] = columnValue(name)

    if (packDeltas) {
      const num = Number(feature.get(lengthField))
      featureDeltas[i] = Number.isFinite(num) ? num : 0
    }

    const value = featurePartition(feature)
    let idx = valueIndex.get(value)
    if (idx === undefined) {
      idx = partitionValues.length
      partitionValues.push(value)
      valueIndex.set(value, idx)
    }
    featurePartitionIndex[i] = idx
    if (colorValues) {
      featureColorValues[i] = colorValues.laneValueOf(feature, idx)
    }
    if (i < PARTITION_VALUE_COUNT_SAMPLE) {
      candidateValues.add(feature)
    }
    const { css, fromBed } = featureColor(feature)
    usedItemRgb ||= fromBed
    featureColors[i] = cssColorToABGR(css)
  }

  return {
    featureStarts,
    featureEnds,
    featureColors,
    featureColorValues,
    colorValues: colorValues?.colorValues,
    featureDeltas,
    partitionValues,
    featurePartitionIndex,
    featureNames,
    featureIds,
    usedItemRgb,
    partitionCandidates,
    partitionCandidateValues: candidateValues.result(),
    resolvedPartitionField,
    legendCandidates: collectLegendCandidates({
      featureNames,
      featureColors,
      featurePartitionIndex,
    }),
  }
}
