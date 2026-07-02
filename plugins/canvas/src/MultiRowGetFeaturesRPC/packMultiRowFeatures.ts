import { readConfigValue } from '@jbrowse/core/configuration'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { MultiRowGetFeaturesResult } from './rpcTypes.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Resolve the (possibly jexl) `color` slot to a CSS string for one feature,
// degrading to goldenrod on a bad expression or non-string result.
function evalColorSlot(
  colorCfg: { color: string },
  feature: Feature,
  jexl: JexlInstance,
) {
  try {
    const css = readConfigValue(colorCfg, 'color', feature, jexl)
    return typeof css === 'string' ? css : 'goldenrod'
  } catch {
    return 'goldenrod'
  }
}

/**
 * Pack features into the multi-row wire arrays: absolute genomic start/end, a
 * per-feature ABGR color (the `color` slot evaluated per feature — this is the
 * per-feature axis, e.g. per-segment `itemRgb` painting), and a row reference
 * indirected through a deduplicated `partitionValues` list (so row strings ship
 * once, not per feature). Pure — the worker supplies the features.
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
  colorConfig: string
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
  const colorCfg = { color: colorConfig }

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
    featureColors[i] = cssColorToABGR(evalColorSlot(colorCfg, feature, jexl))
  }

  return {
    featureStarts,
    featureEnds,
    featureColors,
    partitionValues,
    featurePartitionIndex,
    featureNames,
    featureIds,
  }
}
