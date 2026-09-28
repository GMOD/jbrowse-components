import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import { scaleExtent } from '@jbrowse/core/util/quantileExtent'
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import { featureColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'

import type { MarkConfig } from './configSchema.ts'
import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { StepChannels } from './stepChannels.ts'
import type {
  ColorScaleTable,
  ContinuousRef,
  ThresholdRef,
} from '@jbrowse/core/util/markEncoding'

/**
 * A quantitative colour over the field a mark plots: the declaration the
 * display resolves itself, off the `y` lane, so the colour is neither a lane
 * in the payload nor an input to the fetch.
 */
export type ValueColor = ContinuousRef | ThresholdRef

/**
 * The colour declaration of a mark whose colour is a linear, log or threshold
 * scale over the field its `y` reads, named or filled by its steps; undefined
 * for every other colour.
 */
export function valueColorOf(
  mark: MarkConfig,
  channels: StepChannels,
): ValueColor | undefined {
  const encoding = featureColorEncoding(mark.encoding.color)
  if (typeof encoding !== 'object') {
    return undefined
  }
  const y = mark.encoding.y || channels.y
  if (!y || encoding.field !== y) {
    return undefined
  }
  const { scale } = encoding
  return scale === 'linear' || scale === 'log' || scale === 'threshold'
    ? encoding
    : undefined
}

// The table the worker would have resolved, built off the plotted values.
function valueScaleTable(
  layer: StoredLayer,
  color: ValueColor,
): ColorScaleTable {
  if (color.scale === 'threshold') {
    return {
      kind: 'threshold',
      field: color.field,
      domain: thresholdCuts(color.domain ?? []),
      ...(color.range ? { range: [...color.range] } : {}),
    }
  }
  const extent = scaleExtent(
    layer.y!,
    layer.count,
    color.scale,
    color.domainQuantile,
  )
  const { domain, lut } = continuousColorScale(color, extent)
  const { domainMin, domainMax, domainMid, domainQuantile, range, scheme } =
    color
  return {
    kind: 'ramp',
    field: color.field,
    scale: color.scale,
    domain,
    pinned: [domainMin !== undefined, domainMax !== undefined],
    ...(domainMid === undefined ? {} : { domainMid }),
    ...(range ? { range: [...range] } : {}),
    ...(scheme ? { scheme } : {}),
    ...(color.reverse ? { reverse: true } : {}),
    extent,
    ...(domainQuantile !== undefined && domainQuantile < 1
      ? { quantile: domainQuantile }
      : {}),
    lut,
  }
}

/**
 * The region with each value-coloured layer's colour resolved off its `y`
 * lane: the lane aliased as `colorValue`, no bytes copied, and the scale table
 * the legend, the hover and the shaders read built from the declaration and
 * the values. Once per region and per declaration, so a colour edit re-stamps
 * every region and refetches none.
 */
export function withValueColors(
  region: MarkRegionData,
  colors: readonly (ValueColor | undefined)[],
): MarkRegionData {
  if (colors.every(color => color === undefined)) {
    return region
  }
  return {
    ...region,
    layers: region.layers.map((layer, i) => {
      const color = colors[i]
      return color && layer.y && layer.count > 0
        ? {
            ...layer,
            colorValue: layer.y,
            scale: valueScaleTable(layer, color),
          }
        : color && layer.y
          ? { ...layer, colorValue: layer.y }
          : layer
    }),
  }
}
