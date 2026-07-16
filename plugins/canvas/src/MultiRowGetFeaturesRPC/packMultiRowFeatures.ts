import { readConfigValue } from '@jbrowse/core/configuration'
import { cssColorToABGR, featureBedColor } from '@jbrowse/core/util/colorBits'

import { MULTIROW_DEFAULT_COLOR } from './multiRowColors.ts'

import type { MultiRowGetFeaturesResult } from './rpcTypes.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Resolve the (possibly jexl) `color` slot to a CSS string for one feature,
// degrading to the default color on a bad expression or non-string result. Only
// called for a set slot — an unset one never reaches here.
export function evalColorSlot(
  colorCfg: { color: string },
  feature: Feature,
  jexl: JexlInstance,
) {
  try {
    const css = readConfigValue(colorCfg, 'color', feature, jexl)
    return typeof css === 'string' ? css : MULTIROW_DEFAULT_COLOR
  } catch {
    return MULTIROW_DEFAULT_COLOR
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
  const colorCfg = { color: colorConfig ?? MULTIROW_DEFAULT_COLOR }
  return (feature: Feature) => {
    const bedColor = slotIsUnset ? featureBedColor(feature) : undefined
    return {
      css: bedColor ?? evalColorSlot(colorCfg, feature, jexl),
      fromBed: bedColor !== undefined,
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
  colorConfig,
  jexl,
  report,
}: {
  features: Feature[]
  partitionField: string
  colorConfig: string | undefined
  jexl: JexlInstance
  report?: ProgressReporter
}): MultiRowGetFeaturesResult {
  const n = features.length
  const featureStarts = new Uint32Array(n)
  const featureEnds = new Uint32Array(n)
  const featureColors = new Uint32Array(n)
  const featurePartitionIndex = new Uint32Array(n)
  const featureNames: string[] = new Array(n)
  const featureIds: string[] = new Array(n)
  const partitionValues: string[] = []
  const valueIndex = new Map<string, number>()
  // an unset (`maybeColor` undefined) slot is what lets the file's own color, or
  // the per-row palette, paint — see the `color` slot in configSchema.ts
  const featureColor = makeFeatureColorResolver(colorConfig, jexl)
  let usedItemRgb = false

  for (let i = 0; i < n; i++) {
    report?.(i)
    const feature = features[i]!
    featureStarts[i] = feature.get('start')
    featureEnds[i] = feature.get('end')
    featureIds[i] = feature.id()
    const name = feature.get('name')
    featureNames[i] = typeof name === 'string' ? name : ''

    const raw = feature.get(partitionField)
    const value = raw === undefined || raw === null ? '' : String(raw)
    let idx = valueIndex.get(value)
    if (idx === undefined) {
      idx = partitionValues.length
      partitionValues.push(value)
      valueIndex.set(value, idx)
    }
    featurePartitionIndex[i] = idx
    const { css, fromBed } = featureColor(feature)
    usedItemRgb ||= fromBed
    featureColors[i] = cssColorToABGR(css)
  }

  return {
    featureStarts,
    featureEnds,
    featureColors,
    partitionValues,
    featurePartitionIndex,
    featureNames,
    featureIds,
    usedItemRgb,
  }
}
