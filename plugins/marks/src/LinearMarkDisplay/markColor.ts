/**
 * Where a mark's colour is worked out (ADR-202).
 *
 * The worker holds the features, so it reads from each one only the raw data
 * a colour needs: a category's key, or a number. This module, on the main
 * thread, turns that data into colours through the config. An edit that only
 * changes how data maps to colour — a constant, a palette, a domain, a
 * threshold's cuts, a ramp's ends — then recolours what is already loaded and
 * fetches nothing.
 *
 * For example, `color: { field: 'type', scale: 'categorical' }` asks the worker
 * for each feature's index into the types it met, and an edit to `range`
 * repaints those indexes here. A ramp over `score` on a bar whose `y` is
 * `score` asks the worker for nothing extra: it reads the heights the bar
 * already has.
 */
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

/** A colour over a number: a ramp, or a threshold's bands. */
export type ValueColor = ContinuousRef | ThresholdRef

/** How a mark's colour is worked out: one of four ways. */
export type ColorSource =
  /** One colour for every feature; the worker reads nothing for it. */
  | { kind: 'constant'; color: number }
  /** A colour per category; the worker sends each feature's category key. */
  | { kind: 'categories'; encoding: CategoricalRef & { range?: string[] } }
  /**
   * A ramp or threshold over a number; the worker sends the numbers, unless
   * they are the `y` values the mark already plots (`fromY`).
   */
  | { kind: 'numbers'; encoding: ValueColor; fromY: boolean }
  /** A `jexl:` expression the worker evaluates per feature into a colour. */
  | { kind: 'expression'; encoding: string }

export function markColorOf(
  mark: MarkConfig,
  channels: StepChannels,
): ColorSource {
  const encoding = featureColorEncoding(mark.encoding.color)
  if (typeof encoding !== 'object') {
    const value = encoding ?? DEFAULT_MARK_COLOR
    return isJexl(value)
      ? { kind: 'expression', encoding: value }
      : { kind: 'constant', color: cssColorToABGR(value) }
  }
  if (encoding.scale === 'categorical') {
    return { kind: 'categories', encoding }
  }
  const y = mark.encoding.y || channels.y
  return {
    kind: 'numbers',
    encoding,
    fromY: plotsValue(mark.mark) && !!y && encoding.field === y,
  }
}

/**
 * What the worker is asked to read for the colour: the field alone for a
 * scale, and the default colour, which it ignores, where it reads nothing.
 * A number field is asked for as a threshold with no cuts: that reads the
 * numbers and flags missing ones without building a ramp, whose cached
 * lookup table would be copied on every fetch.
 */
export function wireColorOf(color: ColorSource): ColorEncoding {
  switch (color.kind) {
    case 'expression':
      return color.encoding
    case 'categories':
      return { field: color.encoding.field, scale: 'categorical' }
    case 'numbers':
      return color.fromY
        ? DEFAULT_MARK_COLOR
        : { field: color.encoding.field, scale: 'threshold' }
    case 'constant':
      return DEFAULT_MARK_COLOR
  }
}

/** The lanes the worker fills for the colour. */
export function colorLanesOf(color: ColorSource): MarkLane[] {
  switch (color.kind) {
    case 'constant':
      return []
    case 'expression':
      return ['color']
    case 'categories':
      return ['colorKey']
    case 'numbers':
      return color.fromY ? [] : ['colorValue']
  }
}

// The table the legend, the hover and the shaders read for a ramp or
// threshold, built from the config and the region's numbers, keeping which
// missing or non-numeric values the worker met.
function numberScaleTable(
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
      // the GPU holds this many cuts, so the key lists only bands that paint
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

// Each feature's category key, looked up in the worker's list of the keys it
// met, painted through the config's domain and range, the list reordered to
// the config's domain for the legend. Keys of another field, or with no
// categorical config, take the field's own default colours.
function colorByKeys<L extends EncodedChannels>(
  layer: L,
  keys: Uint32Array,
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
    color[k] = palette[keys[k]!]!
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

const DEFAULT_ABGR = cssColorToABGR(DEFAULT_MARK_COLOR)

// A region the worker read for another kind of colour, drawn while its refetch is
// on the way: whatever it holds coloured as plainly as it can be, so the mark
// stays on screen. Keys take their field's default colours, numbers a linear
// ramp over themselves, an expression's colours stay, and a region holding no
// colour data takes the default colour.
function colorWhileRefetching<L extends EncodedChannels>(layer: L): L {
  const read = layer.scale
  if (layer.colorKey) {
    return colorByKeys(layer, layer.colorKey)
  }
  if (layer.colorValue && read) {
    const ramp: ContinuousRef = { field: read.field, scale: 'linear' }
    return {
      ...layer,
      scale:
        layer.count > 0
          ? numberScaleTable(layer.colorValue, layer.count, ramp, read)
          : undefined,
    }
  }
  return layer.color === undefined && !layer.colorValue
    ? { ...layer, color: DEFAULT_ABGR }
    : layer
}

/**
 * One layer, as the worker sent it, with its colour worked out from `color`:
 * the colour lane and scale table the painters, the legend and the hover read.
 * Exported for multi-way synteny's lane layers, which hold layers outside a
 * region.
 */
export function withMarkColor<L extends EncodedChannels>(
  layer: L,
  color: ColorSource,
): L {
  switch (color.kind) {
    case 'expression':
      return layer.color === undefined ? colorWhileRefetching(layer) : layer
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
    case 'categories':
      return layer.colorKey
        ? colorByKeys(layer, layer.colorKey, color.encoding)
        : colorWhileRefetching(layer)
    case 'numbers': {
      const { fromY, encoding } = color
      const read = layer.scale
      const values = fromY ? layer.y : layer.colorValue
      if (!values || (!fromY && read?.field !== encoding.field)) {
        return colorWhileRefetching(layer)
      }
      return {
        ...layer,
        colorValue: values,
        colorKey: undefined,
        scale:
          layer.count > 0
            ? numberScaleTable(values, layer.count, encoding, read)
            : undefined,
      }
    }
  }
}

/**
 * Every layer of a region coloured as `withMarkColor` colours one,
 * and the region itself where nothing changed. The display runs this once per
 * region and per set of colours, before anything else reads the region.
 */
export function withMarkColors(
  region: MarkRegionData,
  colors: readonly ColorSource[],
): MarkRegionData {
  const layers = region.layers.map((layer, i) => {
    const color = colors[i]
    return color ? withMarkColor(layer, color) : layer
  })
  return layers.every((layer, i) => layer === region.layers[i])
    ? region
    : { ...region, layers }
}
