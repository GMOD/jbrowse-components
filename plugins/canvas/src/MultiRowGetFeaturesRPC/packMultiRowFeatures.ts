import {
  evaluateForFeature,
  isCallbackValue,
} from '@jbrowse/core/configuration'
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
  RowsFieldCandidateValues,
} from './rpcTypes.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

function evalColorSlot(color: string, feature: Feature, jexl: JexlInstance) {
  try {
    const css = evaluateForFeature(color, feature, jexl)
    return typeof css === 'string' ? css : featureDefaultColor
  } catch {
    return featureDefaultColor
  }
}

export function makeFeatureColorResolver(
  { value, itemRgbOn }: Pick<WorkerColor, 'value' | 'itemRgbOn'>,
  jexl: JexlInstance,
) {
  if (value === undefined) {
    const fallback = { css: featureDefaultColor, fromBed: false }
    return (feature: Feature) => {
      const bedColor = featureBedColor(feature, itemRgbOn)
      return bedColor === undefined
        ? fallback
        : { css: bedColor, fromBed: true }
    }
  } else if (isCallbackValue(value)) {
    return (feature: Feature) => ({
      css: evalColorSlot(value, feature, jexl),
      fromBed: false,
    })
  } else {
    const constant = { css: value, fromBed: false }
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
  featureRowValueIndex,
}: Pick<
  MultiRowRegionData,
  'featureNames' | 'featureColors' | 'featureRowValueIndex'
>) {
  const collector = createLegendCandidateCollector()
  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i]!
    if (name !== '') {
      collector.add(featureRowValueIndex[i]!, name, featureColors[i]!)
    }
  }
  return collector.candidates
}

const NON_ATTRIBUTE_TAGS = new Set([
  'start',
  'end',
  'refName',
  'uniqueId',
  'subfeatures',
  'parentId',
])

// Values a block paints by, never names a row stands for.
const NON_ROW_FIELDS = new Set(['strand', 'score', 'phase'])

const FIELD_NAME_SAMPLE = 20

/**
 * Enumerates attributes through `toJSON`, not `tags()`: `tags` is
 * `SimpleFeature`'s, and the `Feature` interface an adapter may implement
 * carries only the serializer.
 */
function collectFieldNames(features: Feature[]) {
  const names = new Set<string>()
  const n = Math.min(features.length, FIELD_NAME_SAMPLE)
  for (let i = 0; i < n; i++) {
    for (const tag of Object.keys(features[i]!.toJSON())) {
      if (!NON_ATTRIBUTE_TAGS.has(tag)) {
        names.add(tag)
      }
    }
  }
  return [...names].sort()
}

/** The attribute names "One row per..." offers. */
export function rowsFieldCandidatesOf(fieldNames: readonly string[]) {
  return fieldNames.filter(name => !NON_ROW_FIELDS.has(name))
}

export const MAX_COUNTED_ROW_VALUES = 200

// Truncating makes the count approximate: two values sharing this prefix
// undercount by one.
export const MAX_ROW_VALUE_LENGTH = 64

export const ROW_VALUE_COUNT_SAMPLE = 5_000

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
          columnValue(feature.get(field)).slice(0, MAX_ROW_VALUE_LENGTH),
        )
        if (values.size > MAX_COUNTED_ROW_VALUES) {
          active.delete(field)
          overflowed.add(field)
        }
      }
    },
    result(): RowsFieldCandidateValues[] {
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

// The color field's value per feature, the main thread's to paint: each
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

export const AUTO_ROWS_FIELD = ''

const PREFERRED_ROWS_FIELDS = ['repClass']

const FALLBACK_ROWS_FIELD = 'name'

/**
 * Only the worker knows which columns the data carries, so it picks the field
 * and reports it back as `resolvedRowsField` — clustering has to ask for
 * the same one to land each feature in the row the painting drew it in.
 */
export function resolveRowsField(
  rowsField: string,
  rowsFieldCandidates: string[],
) {
  const preferred = PREFERRED_ROWS_FIELDS.find(f =>
    rowsFieldCandidates.includes(f),
  )
  return rowsField === AUTO_ROWS_FIELD
    ? preferred === undefined
      ? FALLBACK_ROWS_FIELD
      : preferred
    : rowsField
}

/**
 * Reads a field the way `color.field` does, through core's `fieldReader`: a
 * name, a dotted path or a `jexl:` expression. Both the row a feature paints
 * in and the value it clusters on come through here — were the two to drift,
 * the cluster order would describe rows the painting never drew. An
 * expression that does not compile throws here, as a facet's does, and a
 * feature it fails on reads ''.
 */
export function makeFeatureValueResolver(field: string, jexl: JexlInstance) {
  const read = fieldReader(field, jexl)
  return (feature: Feature) => {
    try {
      return valueText(read(feature))
    } catch {
      return ''
    }
  }
}

interface Span {
  start: number
  end: number
}

/**
 * The blocks a spliced feature paints, in order and disjoint: the union of its
 * children while none has children of its own, so a BED12 row paints its
 * blocks and a transcript its exons with their CDS. Undefined for a feature
 * that paints whole, a gene over its transcripts included.
 */
export function splicedParts(feature: Feature): Span[] | undefined {
  const subfeatures = feature.get('subfeatures')
  if (
    !subfeatures?.length ||
    subfeatures.some(sub => sub.get('subfeatures')?.length)
  ) {
    return undefined
  }
  const sorted = subfeatures
    .map(sub => ({ start: sub.get('start'), end: sub.get('end') }))
    .sort((a, b) => a.start - b.start)
  const merged = [sorted[0]!]
  for (const span of sorted.slice(1)) {
    const last = merged.at(-1)!
    if (span.start <= last.end) {
      last.end = Math.max(last.end, span.end)
    } else {
      merged.push(span)
    }
  }
  return merged
}

/**
 * The entries `[first, last]` of the feature entry `i` belongs to: its parts
 * are consecutive and share its id, so the feature spans
 * `featureStarts[first]` to `featureEnds[last]`.
 */
export function featureRun(featureIds: readonly string[], i: number) {
  let first = i
  let last = i
  while (first > 0 && featureIds[first - 1] === featureIds[i]) {
    first--
  }
  while (
    last + 1 < featureIds.length &&
    featureIds[last + 1] === featureIds[i]
  ) {
    last++
  }
  return [first, last] as const
}

/**
 * One entry per painted part, each carrying its feature's id, row and color,
 * so a spliced feature's blocks are consecutive entries sharing an id.
 */
export function packMultiRowFeatures({
  features,
  rowsField,
  colorConfig,
  jexl,
  report,
}: {
  features: Feature[]
  rowsField: string
  colorConfig: WorkerColor
  jexl: JexlInstance
  report?: ProgressReporter
}): MultiRowGetFeaturesResult {
  const parts = features.map(splicedParts)
  const n = parts.reduce((sum, p) => sum + (p?.length ?? 1), 0)
  const featureStarts = new Uint32Array(n)
  const featureEnds = new Uint32Array(n)
  const featureColors = new Uint32Array(n)
  const featureRowValueIndex = new Uint32Array(n)
  const featureNames: string[] = new Array(n)
  const featureIds: string[] = new Array(n)
  const rowValues: string[] = []
  const valueIndex = new Map<string, number>()
  const featureColor = makeFeatureColorResolver(colorConfig, jexl)
  const colorValues = colorConfig.field
    ? createColorValueCollector(colorConfig.field, jexl)
    : undefined
  const rectColorValues = new Uint32Array(colorValues ? n : 0)
  const fieldNames = collectFieldNames(features)
  const rowsFieldCandidates = rowsFieldCandidatesOf(fieldNames)
  const resolvedRowsField = resolveRowsField(rowsField, rowsFieldCandidates)
  const candidateValues = createCandidateValueCounter(rowsFieldCandidates)
  const featureRowValue = makeFeatureValueResolver(resolvedRowsField, jexl)
  let usedItemRgb = false

  let j = 0
  for (let i = 0; i < features.length; i++) {
    report?.(i)
    const feature = features[i]!
    const id = feature.id()
    const name = columnValue(feature.get('name'))

    const value = featureRowValue(feature)
    let idx = valueIndex.get(value)
    if (idx === undefined) {
      idx = rowValues.length
      rowValues.push(value)
      valueIndex.set(value, idx)
    }
    const rectColorValue = colorValues?.laneValueOf(feature, idx) ?? 0
    if (i < ROW_VALUE_COUNT_SAMPLE) {
      candidateValues.add(feature)
    }
    const { css, fromBed } = featureColor(feature)
    usedItemRgb ||= fromBed
    const abgr = cssColorToABGR(css)
    for (const part of parts[i] ?? [undefined]) {
      featureStarts[j] = part ? part.start : feature.get('start')
      featureEnds[j] = part ? part.end : feature.get('end')
      featureIds[j] = id
      featureNames[j] = name
      featureRowValueIndex[j] = idx
      if (colorValues) {
        rectColorValues[j] = rectColorValue
      }
      featureColors[j] = abgr
      j++
    }
  }

  return {
    featureStarts,
    featureEnds,
    featureColors,
    rectColorValues,
    colorValues: colorValues?.colorValues,
    rowValues,
    featureRowValueIndex,
    featureNames,
    featureIds,
    usedItemRgb,
    fieldNames,
    rowsFieldCandidateValues: candidateValues.result(),
    resolvedRowsField,
    legendCandidates: collectLegendCandidates({
      featureNames,
      featureColors,
      featureRowValueIndex,
    }),
  }
}
