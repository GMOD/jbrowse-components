import { isCallbackValue, readConfigValue } from '@jbrowse/core/configuration'
import { cssColorToABGR, featureBedColor } from '@jbrowse/core/util/colorBits'
import { createLegendCandidateCollector } from '@jbrowse/core/util/legendCandidates'

import { FEATURE_DEFAULT_COLOR } from '../RenderFeatureDataRPC/featureColors.ts'

import type {
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
    return typeof css === 'string' ? css : FEATURE_DEFAULT_COLOR
  } catch {
    return FEATURE_DEFAULT_COLOR
  }
}

/**
 * The clustering RPC resolves colors through this same function, because rows
 * there cluster by which colors fall at which positions — a drift between the
 * two would order the rows on colors nobody sees.
 */
export function makeFeatureColorResolver(
  colorConfig: string | undefined,
  jexl: JexlInstance,
) {
  if (colorConfig === undefined) {
    const fallback = { css: FEATURE_DEFAULT_COLOR, fromBed: false }
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
    collector.add(
      featurePartitionIndex[i]!,
      featureNames[i]!,
      featureColors[i]!,
    )
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
 * The clustering RPC resolves rows through this same function — were the two to
 * drift, the cluster order would describe rows the painting never drew.
 */
export function makeFeaturePartitionResolver(
  partitionField: string,
  jexl: JexlInstance,
) {
  if (!isCallbackValue(partitionField)) {
    return (feature: Feature) => columnValue(feature.get(partitionField))
  }
  const cfg = { partitionField }
  return (feature: Feature) => {
    try {
      return columnValue(readConfigValue(cfg, 'partitionField', feature, jexl))
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
  colorConfig: string | undefined
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
  const featureColor = makeFeatureColorResolver(colorConfig, jexl)
  const partitionCandidates = collectPartitionCandidates(features)
  const resolvedPartitionField = resolvePartitionField(
    partitionField,
    partitionCandidates,
  )
  const candidateValues = createCandidateValueCounter(partitionCandidates)
  const featurePartition = makeFeaturePartitionResolver(
    resolvedPartitionField,
    jexl,
  )
  const abgrByCss = new Map<string, number>()
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
    if (i < PARTITION_VALUE_COUNT_SAMPLE) {
      candidateValues.add(feature)
    }
    const { css, fromBed } = featureColor(feature)
    usedItemRgb ||= fromBed
    let abgr = abgrByCss.get(css)
    if (abgr === undefined) {
      abgr = cssColorToABGR(css)
      abgrByCss.set(css, abgr)
    }
    featureColors[i] = abgr
  }

  return {
    featureStarts,
    featureEnds,
    featureColors,
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
