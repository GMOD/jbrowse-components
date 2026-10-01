import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  DEFAULT_MARK_COLOR,
  continuousColorScale,
} from '@jbrowse/core/util/markEncoding'
import { scaleExtent } from '@jbrowse/core/util/quantileExtent'
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import { featureColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'
import { MAX_COLOR_CUTS } from '@jbrowse/render-core/shaders/markColorConsts'

import { plotsValue } from './markSpecs.ts'

import type { MarkConfig } from './configSchema.ts'
import type { MarkRegionData } from './markList.ts'
import type { MarkLane } from './markSpecs.ts'
import type { StepChannels } from './stepChannels.ts'
import type {
  CategoricalRef,
  ColorEncoding,
  ColorScaleTable,
  ContinuousRef,
  EncodedChannels,
  ThresholdRef,
} from '@jbrowse/core/util/markEncoding'

/** A quantitative colour: a ramp or a threshold over a numeric field. */
export type ValueColor = ContinuousRef | ThresholdRef

/**
 * How a mark's colour resolves. Every form but `worker` resolves on the main
 * thread off what the worker read, so an edit to it re-stamps the regions and
 * refetches none: a `constant`, a `categorical` scale over the keys each
 * region met, and a `value` scale over the numbers, read off the `y` lane
 * where the colour reads the field the mark plots. A `jexl:` callback is the
 * worker's, since it reads the feature.
 */
export type MarkColor =
  | { kind: 'constant'; color: number }
  | {
      kind: 'categorical'
      encoding: CategoricalRef & { range?: string[] }
    }
  | { kind: 'value'; encoding: ValueColor; readsY: boolean }
  | { kind: 'worker'; encoding: string }

export function markColorOf(
  mark: MarkConfig,
  channels: StepChannels,
): MarkColor {
  const encoding = featureColorEncoding(mark.encoding.color)
  if (typeof encoding !== 'object') {
    const value = encoding ?? DEFAULT_MARK_COLOR
    return isJexl(value)
      ? { kind: 'worker', encoding: value }
      : { kind: 'constant', color: cssColorToABGR(value) }
  }
  if (encoding.scale === 'categorical') {
    return { kind: 'categorical', encoding }
  }
  const y = mark.encoding.y || channels.y
  return {
    kind: 'value',
    encoding,
    readsY: plotsValue(mark.mark) && !!y && encoding.field === y,
  }
}

/**
 * The colour as the worker takes it: what it reads per feature and nothing
 * the display paints through, so the field alone crosses for a scale and the
 * default for a constant. A quantitative field crosses as a threshold with no
 * cuts, which reads the numbers and flags the keyless ones and builds no
 * ramp table, whose shared lookup table would be cloned on every fetch.
 */
export function wireColorOf(color: MarkColor): ColorEncoding {
  switch (color.kind) {
    case 'worker':
      return color.encoding
    case 'categorical':
      return { field: color.encoding.field, scale: 'categorical' }
    case 'value':
      return color.readsY
        ? DEFAULT_MARK_COLOR
        : { field: color.encoding.field, scale: 'threshold' }
    case 'constant':
      return DEFAULT_MARK_COLOR
  }
}

/** The lanes the worker fills for the colour. */
export function colorLanesOf(color: MarkColor): MarkLane[] {
  switch (color.kind) {
    case 'worker':
    case 'constant':
      return ['color']
    case 'categorical':
      return ['colorKey']
    case 'value':
      return color.readsY ? [] : ['colorValue']
  }
}

function valueScaleTable(
  values: Float32Array,
  count: number,
  color: ValueColor,
  read: ColorScaleTable | undefined,
): ColorScaleTable {
  const met = {
    ...(read && 'missing' in read && read.missing ? { missing: true } : {}),
    ...(read && 'notNumber' in read && read.notNumber
      ? { notNumber: true }
      : {}),
  }
  if (color.scale === 'threshold') {
    return {
      kind: 'threshold',
      field: color.field,
      // the cuts the shader holds, so the key lists the bands that paint
      domain: thresholdCuts(color.domain ?? []).slice(0, MAX_COLOR_CUTS),
      ...(color.range ? { range: [...color.range] } : {}),
      ...met,
    }
  }
  const extent = scaleExtent(values, count, color.scale, color.domainQuantile)
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
    ...met,
  }
}

// Each key the worker met, painted through the declaration and ordered by it;
// keys of another field, or under no categorical declaration, paint as the
// worker's table did.
function categoricalLayer<L extends EncodedChannels>(
  layer: L,
  colorKey: Uint32Array,
  encoding?: CategoricalRef & { range?: string[] },
): L {
  const read = layer.scale
  if (read?.kind !== 'categorical') {
    return layer
  }
  const { field } = read
  const own = encoding?.field === field ? encoding : undefined
  const declared = categoricalField(field, {
    domain: own?.domain?.map(String),
    range: own?.range,
  })
  const palette = Uint32Array.from(read.entries, e =>
    cssColorToABGR(declared.color(e.value)),
  )
  const color = new Uint32Array(layer.count)
  for (let k = 0; k < layer.count; k++) {
    color[k] = palette[colorKey[k]!]!
  }
  const entries = read.entries
    .map((e, i) => ({ value: e.value, color: palette[i]! }))
    .sort((a, b) => declared.compare(a.value, b.value))
  return {
    ...layer,
    color,
    colorKey: undefined,
    scale: {
      kind: 'categorical',
      field,
      domain: [...declared.domain],
      ...(own?.range ? { range: [...own.range] } : {}),
      ...(read.numericKeys ? { numericKeys: true } : {}),
      entries,
    },
  }
}

// A layer fetched under another form of colour, while its refetch is pending:
// its keys painted as the worker's table did, so it stays drawn, and any
// other lane as it came.
function heldLayer<L extends EncodedChannels>(layer: L): L {
  return layer.colorKey ? categoricalLayer(layer, layer.colorKey) : layer
}

/**
 * One layer with its colour resolved off what the worker read, for a caller
 * holding layers outside a region: multi-way synteny's lane layers.
 */
export function withMarkColor<L extends EncodedChannels>(
  layer: L,
  color: MarkColor,
): L {
  switch (color.kind) {
    case 'worker':
      return heldLayer(layer)
    case 'constant':
      return layer.color === color.color &&
        !layer.colorValue &&
        !layer.colorKey &&
        !layer.scale
        ? layer
        : {
            ...layer,
            color: color.color,
            colorValue: undefined,
            colorKey: undefined,
            scale: undefined,
          }
    case 'categorical':
      return layer.colorKey
        ? categoricalLayer(layer, layer.colorKey, color.encoding)
        : layer
    case 'value': {
      const { readsY, encoding } = color
      const read = layer.scale
      const values = readsY ? layer.y : layer.colorValue
      if (!values || (!readsY && read?.field !== encoding.field)) {
        return heldLayer(layer)
      }
      return {
        ...layer,
        colorValue: values,
        scale:
          layer.count > 0
            ? valueScaleTable(values, layer.count, encoding, read)
            : undefined,
      }
    }
  }
}

/**
 * The region with each layer's colour resolved off what the worker read: a
 * constant as the number every instance paints, a categorical scale's keys
 * painted into a lane, and a quantitative scale's table built over the values,
 * the `y` lane aliased as `colorValue` where the colour reads it. The legend,
 * the hover and the painters then read the lane and the table as though the
 * worker had filled them. Once per region and per declaration, so a colour
 * edit re-stamps every region and refetches none.
 */
export function withMarkColors(
  region: MarkRegionData,
  colors: readonly MarkColor[],
): MarkRegionData {
  const layers = region.layers.map((layer, i) => {
    const color = colors[i]
    return color ? withMarkColor(layer, color) : layer
  })
  return layers.every((layer, i) => layer === region.layers[i])
    ? region
    : { ...region, layers }
}
