/**
 * Where a mark's color is worked out (ADR-202).
 *
 * The worker holds the features, so it reads from each one only the raw data
 * a color needs: a category's key, or a number. This module, on the main
 * thread, turns that data into colors through the config. An edit that only
 * changes how data maps to color — a constant, a palette, a domain, a
 * threshold's cuts, a ramp's ends — then recolors what is already loaded and
 * fetches nothing.
 *
 * For example, `color: { field: 'type', scale: 'categorical' }` asks the worker
 * for each feature's index into the types it met, and an edit to `range`
 * repaints those indexes here. A ramp over `score` on a bar whose `y` is
 * `score` asks the worker for nothing extra: it reads the heights the bar
 * already has.
 */
import {
  categoricalField,
  dealKeyColors,
} from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  DEFAULT_MARK_COLOR,
  continuousColorScale,
} from '@jbrowse/core/util/markEncoding'
import { scaleExtent } from '@jbrowse/core/util/quantileExtent'
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import {
  featureColorEncoding,
  paintedColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { MAX_COLOR_CUTS } from '@jbrowse/render-core/shaders/markColorConsts'

import { paintScaleOf } from './legend.ts'
import { plotsValue } from './markSpecs.ts'

import type { MarkConfig } from './configSchema.ts'
import type { MarkRegionData } from './markList.ts'
import type { MarkLane } from './markSpecs.ts'
import type { StepChannels } from './stepChannels.ts'
import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type {
  CategoricalRef,
  ColorEncoding,
  ColorScaleTable,
  ContinuousRef,
  EncodedChannels,
  ThresholdRef,
} from '@jbrowse/core/util/markEncoding'
import type { MarkColorScale } from '@jbrowse/render-core/marks'

/** A color over a number: a ramp, or a threshold's bands. */
export type ValueColor = ContinuousRef | ThresholdRef

/** How a mark's color is worked out: one of four ways. */
export type ColorSource =
  /** One color for every feature; the worker reads nothing for it. */
  | { kind: 'constant'; color: number }
  /**
   * A color per category; the worker sends each feature's category as an
   * index into the categories it met, and each is painted here through the
   * config's `domain` and `range`, dealt into `held` (`heldColorSlots`).
   */
  | {
      kind: 'categories'
      encoding: CategoricalRef & { range?: string[] }
      held?: HeldSlots
    }
  /**
   * A ramp or threshold over a number; the worker sends the numbers, unless
   * they are the `y` values the mark already plots (`fromY`).
   */
  | { kind: 'numbers'; encoding: ValueColor; fromY: boolean }
  /** A `jexl:` expression the worker evaluates per feature into a color. */
  | { kind: 'expression'; encoding: string }

/**
 * `owner` is the display holding the mark, whose track's categorical colors
 * deal into one set of slots; a caller that only asks the worker leaves it
 * out.
 */
export function markColorOf(
  mark: MarkConfig,
  channels: StepChannels,
  owner?: object,
): ColorSource {
  // a key's labels change what the legend says, not what any feature paints
  const encoding = paintedColorEncoding(
    featureColorEncoding(mark.encoding.color),
  )
  if (typeof encoding !== 'object') {
    const value = encoding ?? DEFAULT_MARK_COLOR
    return isJexl(value)
      ? { kind: 'expression', encoding: value }
      : { kind: 'constant', color: cssColorToABGR(value) }
  }
  if (encoding.scale === 'categorical') {
    return {
      kind: 'categories',
      encoding,
      held: owner && heldColorSlots(owner, encoding),
    }
  }
  const y = mark.encoding.y || channels.y
  return {
    kind: 'numbers',
    encoding,
    fromY: plotsValue(mark.mark) && !!y && encoding.field === y,
  }
}

/**
 * What the color asks the worker to read: a `jexl:` expression whole, a
 * scale's field alone, and `DEFAULT_MARK_COLOR` where it reads nothing, which
 * the encoder ignores with no color lane to fill. A number field is asked
 * for as a threshold with no cuts: that reads the numbers and flags missing
 * ones without building a ramp, whose cached lookup table would be copied on
 * every fetch.
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

/** The lanes the worker fills for the color. */
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
// categorical config, take the field's own default colors.
function colorByKeys<L extends EncodedChannels>(
  layer: L,
  keys: Uint32Array,
  encoding?: CategoricalRef & { range?: string[] },
  held?: HeldSlots,
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
    held: own && held,
  })
  dealKeyColors(
    declared,
    read.entries.map(e => e.value),
  )
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

/**
 * Set on a layer colored from data the worker read for an earlier `color`
 * declaration: a region its refetch has not reached yet, or never will while
 * it stays off screen. It paints from what it holds, keys through their
 * field's default colors and numbers through a linear ramp over themselves,
 * and stays out of the legend and the hover's color row, so the mark's scale
 * and key come only from regions read for the declaration as it now stands.
 */
export interface HeldColor {
  heldColor?: boolean
}

// Colors a layer the worker read for an earlier `color` declaration from
// what it holds, and flags it `heldColor`: keys in their field's default
// colors, numbers through a linear ramp over themselves, and the default
// color where it holds no color data. Packed colors, an expression's or
// the density tier's single one, stay as they came and unflagged: they carry
// no table for the key or the scale to take.
function colorAsHeld<L extends EncodedChannels>(layer: L): L {
  const read = layer.scale
  if (layer.colorKey) {
    return { ...colorByKeys(layer, layer.colorKey), heldColor: true }
  }
  if (layer.colorValue && read) {
    const ramp: ContinuousRef = { field: read.field, scale: 'linear' }
    return {
      ...layer,
      heldColor: true,
      scale:
        layer.count > 0
          ? numberScaleTable(layer.colorValue, layer.count, ramp, read)
          : undefined,
    }
  }
  return layer.color === undefined && !layer.colorValue
    ? { ...layer, heldColor: true, color: DEFAULT_ABGR }
    : layer
}

/**
 * The scale a layer paints through: the mark's, for a layer read for the
 * color as it now stands; its own table, for one still holding an earlier
 * declaration's data (`heldColor`); and none for a layer painting packed
 * colors, a constant or a lane of them, which it paints as they are.
 */
export function layerColorScale(
  layer: (EncodedChannels & HeldColor) | undefined,
  markScale: MarkColorScale | undefined,
) {
  return layer?.colorValue
    ? layer.heldColor
      ? paintScaleOf(layer.scale)
      : markScale
    : undefined
}

/**
 * One layer, as the worker sent it, with its color worked out from `color`:
 * the color lane and scale table the painters, the legend and the hover read.
 * Exported for multi-way synteny's lane layers, which hold layers outside a
 * region.
 */
export function withMarkColor<L extends EncodedChannels>(
  layer: L,
  color: ColorSource,
): L {
  switch (color.kind) {
    case 'expression':
      return layer.color === undefined ? colorAsHeld(layer) : layer
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
      return layer.colorKey && layer.scale?.field === color.encoding.field
        ? colorByKeys(layer, layer.colorKey, color.encoding, color.held)
        : colorAsHeld(layer)
    case 'numbers': {
      const { fromY, encoding } = color
      const read = layer.scale
      const values = fromY ? layer.y : layer.colorValue
      if (!values || (!fromY && read?.field !== encoding.field)) {
        return colorAsHeld(layer)
      }
      // the worker's missing-value flags count only where it read this field
      const met = read?.field === encoding.field ? read : undefined
      return {
        ...layer,
        color: undefined,
        colorValue: values,
        colorKey: undefined,
        scale:
          layer.count > 0
            ? numberScaleTable(values, layer.count, encoding, met)
            : undefined,
      }
    }
  }
}

/**
 * Every layer of a region colored as `withMarkColor` colors one,
 * and the region itself where nothing changed. The display runs this once per
 * region and per set of colors, before anything else reads the region.
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
