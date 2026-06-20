import { readConfigValue } from '@jbrowse/core/configuration'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { MultiRowGetFeaturesResult } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * Pack features into the multi-row wire arrays: absolute genomic start/end, a
 * per-feature ABGR color (the `colorConfig` slot evaluated per feature, falling
 * back to goldenrod on a bad expression), and a row reference indirected through
 * a deduplicated `partitionValues` list (so row strings ship once, not per
 * feature). Pure — the worker supplies the features.
 */
export function packMultiRowFeatures(
  features: Feature[],
  partitionField: string,
  colorConfig: string,
  jexl?: JexlInstance,
): MultiRowGetFeaturesResult {
  const n = features.length
  const featureStarts = new Uint32Array(n)
  const featureEnds = new Uint32Array(n)
  const featureColors = new Uint32Array(n)
  const featurePartitionIndex = new Uint32Array(n)
  const featureNames: string[] = new Array(n)
  const partitionValues: string[] = []
  const valueIndex = new Map<string, number>()
  const colorCfg = { color: colorConfig }

  for (let i = 0; i < n; i++) {
    const feature = features[i]!
    featureStarts[i] = feature.get('start')
    featureEnds[i] = feature.get('end')
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

    let css: unknown
    try {
      css = readConfigValue(colorCfg, 'color', feature, jexl)
    } catch {
      css = 'goldenrod'
    }
    featureColors[i] = cssColorToABGR(
      typeof css === 'string' ? css : 'goldenrod',
    )
  }

  return {
    featureStarts,
    featureEnds,
    featureColors,
    partitionValues,
    featurePartitionIndex,
    featureNames,
  }
}
