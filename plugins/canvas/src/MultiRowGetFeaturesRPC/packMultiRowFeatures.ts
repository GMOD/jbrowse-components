import { isCallbackValue, readConfigValue } from '@jbrowse/core/configuration'
import { cssColorToABGR, featureBedColor } from '@jbrowse/core/util/colorBits'

// multi-row's unset-slot fallback is just the generic feature default; unset is
// also what turns on the per-row palette (resolveRowColors), which paints over
// this on the main thread, so it's mostly invisible. A pure fallback, never
// compared against a stored value (the slot is a `maybeColor`).
import { FEATURE_DEFAULT_COLOR } from '../RenderFeatureDataRPC/featureColors.ts'

import type { MultiRowGetFeaturesResult } from './rpcTypes.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Resolve the (possibly jexl) `color` slot to a CSS string for one feature,
// degrading to the default color on a bad expression or non-string result.
// Called for a set slot, or for an unset slot when the feature carries no BED
// color (the resolver falls back to it with `colorCfg.color` = the default).
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
 * Build the per-feature color resolver for a `color` slot value. A BED that
 * declares its own color has already said how it wants to be painted, so an
 * unset slot yields to it — no jexl needed; any set slot wins. cssColorToABGR
 * understands the bare "255,0,0" triple, so the value goes through as-is. No
 * parent walk: these painting tracks are flat (disableGeneHeuristic), so the
 * drawn feature is the one carrying the color.
 *
 * A factory rather than a plain function so the slot is interpreted exactly
 * once, off the one `colorConfig` — the per-feature work then can't be handed a
 * mismatched pair — and so the jexl config object is hoisted out of the loop.
 *
 * Shared with the clustering RPC on purpose. `colorKey` there is *defined* as
 * the color painted on screen — rows cluster by which colors fall at which
 * positions — so if the two resolutions drifted, an itemRgb painting would
 * cluster on a uniform color nobody sees and silently produce a meaningless
 * order. `fromBed` additionally tells the main thread to drop the per-row
 * palette, which would otherwise cover the colors the BED asked for.
 */
export function makeFeatureColorResolver(
  colorConfig: string | undefined,
  jexl: JexlInstance,
) {
  const slotIsUnset = colorConfig === undefined
  const colorCfg = { color: colorConfig ?? FEATURE_DEFAULT_COLOR }
  // A slot holding a plain CSS color is the same answer for every feature, so
  // resolve it once — the same `isCallbackValue` split
  // `makeFeaturePartitionResolver` makes below, for the same reason. A painting
  // is half a million features per region, and each one was paying a
  // `readConfigValue` call plus a fresh result object to be handed back a
  // constant. Only the callback form needs the per-feature evaluation.
  if (colorConfig !== undefined && !isCallbackValue(colorConfig)) {
    const constant = { css: colorConfig, fromBed: false }
    return () => constant
  }
  return (feature: Feature) => {
    const bedColor = slotIsUnset ? featureBedColor(feature) : undefined
    return {
      css: bedColor ?? evalColorSlot(colorCfg, feature, jexl),
      fromBed: bedColor !== undefined,
    }
  }
}

// A BED column arrives as a string or a number depending on the parser, and a
// numeric category (a chromHMM state number, a cluster id) is a real row name,
// so coerce rather than trust. Absent stays '' rather than becoming "undefined".
function partitionValue(raw: unknown) {
  return raw === undefined || raw === null ? '' : String(raw)
}

// Attributes that name a feature's PLACE rather than anything about it. Rows
// keyed on one of these are one row per feature, which is the shape this menu
// exists to get a reader out of.
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

// How many features to read tags off. A BED's columns are the same on every
// line, so one would do; a GFF's attributes are per record, so a few rows cover
// the common case of a file whose first feature happens to omit an optional
// column. Bounded either way — this cannot grow with the region.
const PARTITION_CANDIDATE_SAMPLE = 20

/**
 * The attribute names a reader could partition on, sampled off the head of the
 * feature list. Sorted, so the menu built from it does not reorder itself when a
 * pan changes which features arrive first.
 *
 * Through `toJSON`, not `tags()`: `tags` is `SimpleFeature`'s, and the `Feature`
 * interface an adapter is free to implement carries only the serializer. Both
 * enumerate the same attribute set.
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

// The `partitionField` slot left empty: pick the row attribute off the data.
export const AUTO_PARTITION_FIELD = ''

// What auto picks, in preference order, when the loaded features carry it.
//
// One entry, and it is RepeatMasker's. That file is both the commonest track
// anyone points this display at and the one where the old default was worst:
// `name` on rmsk is the repeat instance, so the display opened as tens of
// thousands of one-feature rows — a hairline each, no structure, and the fix
// (Partition by... → repClass) discoverable only by opening a menu the reader
// had no reason to think they needed. `repClass` is ~20 rows of exactly the
// signal the track is read for.
//
// Kept a list because the next entry is a matter of finding another attribute
// name that is this unambiguous, not of changing anything here.
const PREFERRED_PARTITION_FIELDS = ['repClass']

// What auto falls back to: the feature's own name. Right for a file whose rows
// ARE its names — an ancestry painting keyed by sample — and the historical
// default, so a track that was relying on it keeps its rows.
const FALLBACK_PARTITION_FIELD = 'name'

/**
 * The attribute a region actually partitions on: the configured one, or — when
 * the slot is left empty — the first preferred attribute the data carries.
 *
 * Resolved in the worker, against the same sampled `partitionCandidates` the
 * "Partition by..." menu is built from, because this is the only side that
 * knows the answer before the features are walked. Doing it on the main thread
 * means fetching a region to discover its columns and then fetching it again to
 * partition on one of them, which on the RepeatMasker files this exists for is
 * the expensive half of the load, twice.
 *
 * Reported back as `resolvedPartitionField` so the menu can check the radio for
 * a field nobody configured, and so clustering — which must land each feature in
 * the row the painting drew it in — asks for the same one.
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
 * Build the per-feature row resolver for a `partitionField` value: the plain
 * attribute lookup, or a `jexl:` expression evaluated per feature.
 *
 * The expression form exists because a file can carry the category without
 * carrying a column for it. UCSC's `bigRmskBed` is the case in hand: the class
 * is a suffix on the name (`L1HS#LINE/L1`), so an attribute lookup can only
 * partition on the full repeat name, which is thousands of rows rather than
 * twenty. `jexl:split(split(feature.name,'#')[1],'/')[0]` is the same file read
 * as classes.
 *
 * A factory for the same two reasons the color one is: the slot is interpreted
 * once rather than per feature, and — more importantly — this is SHARED with the
 * clustering RPC on purpose. Rows cluster by which colors fall at which
 * positions in each row, so if the two sides resolved a row differently the
 * cluster order would describe rows nobody is looking at.
 *
 * A throwing expression yields '' for that feature rather than failing the
 * region, mirroring evalColorSlot: one unparseable name costs its own row
 * assignment, not the track.
 */
export function makeFeaturePartitionResolver(
  partitionField: string,
  jexl: JexlInstance,
) {
  if (!isCallbackValue(partitionField)) {
    return (feature: Feature) => partitionValue(feature.get(partitionField))
  }
  const cfg = { partitionField }
  return (feature: Feature) => {
    try {
      return partitionValue(
        readConfigValue(cfg, 'partitionField', feature, jexl),
      )
    } catch {
      return ''
    }
  }
}

/**
 * Pack features into the multi-row wire arrays: absolute genomic start/end, a
 * per-feature ABGR color (the `color` slot evaluated per feature — this is the
 * per-feature axis, e.g. per-segment `itemRgb` painting), and a row reference
 * indirected through a deduplicated `partitionValues` list (so row strings ship
 * once, not per feature). Pure — the worker supplies the features.
 *
 * With the `color` slot at its default, a feature's own `itemRgb` is used when
 * present, and `usedItemRgb` reports that back so the main thread can drop the
 * per-row palette that would otherwise cover it.
 *
 * Per-ROW color (sampleColorMap / palette / the arrangement dialog) is resolved
 * on the main thread at render time (see resolveRowColors), so it never refetches
 * and isn't this function's concern.
 */
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
  // Length-zero when the slot is unset, which is how the render side knows the
  // indel-glyph pass is off — cheaper than a parallel boolean, and it can't
  // disagree with the array it gates.
  const packDeltas = lengthField !== ''
  const featureDeltas = new Int32Array(packDeltas ? n : 0)
  const featureNames: string[] = new Array(n)
  const featureIds: string[] = new Array(n)
  const partitionValues: string[] = []
  const valueIndex = new Map<string, number>()
  // an unset (`maybeColor` undefined) slot is what lets the file's own color, or
  // the per-row palette, paint — see the `color` slot in configSchema.ts
  const featureColor = makeFeatureColorResolver(colorConfig, jexl)
  const partitionCandidates = collectPartitionCandidates(features)
  const resolvedPartitionField = resolvePartitionField(
    partitionField,
    partitionCandidates,
  )
  const featurePartition = makeFeaturePartitionResolver(
    resolvedPartitionField,
    jexl,
  )
  // A painting repeats a handful of color strings across every feature it has —
  // eight ancestry hues over half a million segments — and parsing one is not
  // cheap: trim, lowercase, a named-color lookup, a BED-triple regex, then the
  // parser. Measured at 570ms per 500k features uncached against 6ms memoized,
  // which is most of a second of worker time per region, spent resolving eight
  // answers. The clustering RPC caches the same resolution for the same reason
  // (buildMultiRowMatrix's rgbCache); this side had been left doing it long-hand.
  const abgrByCss = new Map<string, number>()
  let usedItemRgb = false

  for (let i = 0; i < n; i++) {
    report?.(i)
    const feature = features[i]!
    featureStarts[i] = feature.get('start')
    featureEnds[i] = feature.get('end')
    featureIds[i] = feature.id()
    // Coerced the same way the partition value is (see partitionValue), and for
    // the same reason: a BED column arrives as a string or a number depending on the
    // parser, and a numeric name (a chromHMM state number, a numeric category)
    // is a real label — dropped to '' it cost the tooltip its text and the
    // legend its entry, since buildColorLegend skips unnamed features.
    //
    // Typed `unknown` because the `get('name')` overload's `string | undefined`
    // is optimistic about exactly that: this coerced rather than trusted it even
    // when it was throwing the number away.
    const name: unknown = feature.get('name')
    featureNames[i] = name === undefined || name === null ? '' : String(name)

    if (packDeltas) {
      // A BED column arrives as a string or a number depending on the parser, so
      // coerce either way; anything unparsable is 0, which draws no glyph rather
      // than a glyph of garbage length.
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
    resolvedPartitionField,
  }
}
