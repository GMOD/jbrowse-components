import { readConfigValue } from '@jbrowse/core/configuration'
import { tagColorPalette } from '@jbrowse/core/ui/theme'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { MULTIROW_DEFAULT_COLOR } from './multiRowColors.ts'

import type { MultiRowGetFeaturesResult } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Resolve the (possibly jexl) `color` slot to a CSS string for one feature,
// degrading to goldenrod on a bad expression or non-string result.
function evalColorSlot(
  colorCfg: { color: string },
  feature: Feature,
  jexl?: JexlInstance,
) {
  try {
    const css = readConfigValue(colorCfg, 'color', feature, jexl)
    return typeof css === 'string' ? css : 'goldenrod'
  } catch {
    return 'goldenrod'
  }
}

// The per-block color "scale" (→ ABGR): a `sampleColorMap` entry for the row
// wins; else a customized `color` slot is evaluated per feature; else each row
// takes a distinct categorical-palette color by its index. Built once, then
// applied per feature with positional args (no per-feature allocation).
function makeBlockColorScale({
  colorConfig,
  sampleColorMap,
  jexl,
}: {
  colorConfig: string
  sampleColorMap: Record<string, string>
  jexl?: JexlInstance
}) {
  const colorCfg = { color: colorConfig }
  const colorIsDefault = colorConfig === MULTIROW_DEFAULT_COLOR
  return (value: string, rowIndex: number, feature: Feature) => {
    const css =
      sampleColorMap[value] ??
      (colorIsDefault
        ? tagColorPalette[rowIndex % tagColorPalette.length]!
        : evalColorSlot(colorCfg, feature, jexl))
    return cssColorToABGR(css)
  }
}

/**
 * Pack features into the multi-row wire arrays: absolute genomic start/end, a
 * per-feature ABGR color (see makeBlockColorScale), and a row reference
 * indirected through a deduplicated `partitionValues` list (so row strings ship
 * once, not per feature). Pure — the worker supplies the features.
 */
export function packMultiRowFeatures({
  features,
  partitionField,
  colorConfig,
  sampleColorMap,
  jexl,
}: {
  features: Feature[]
  partitionField: string
  colorConfig: string
  sampleColorMap: Record<string, string>
  jexl?: JexlInstance
}): MultiRowGetFeaturesResult {
  const n = features.length
  const featureStarts = new Uint32Array(n)
  const featureEnds = new Uint32Array(n)
  const featureColors = new Uint32Array(n)
  const featurePartitionIndex = new Uint32Array(n)
  const featureNames: string[] = new Array(n)
  const partitionValues: string[] = []
  const valueIndex = new Map<string, number>()
  const blockColor = makeBlockColorScale({ colorConfig, sampleColorMap, jexl })

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
    featureColors[i] = blockColor(value, idx, feature)
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
