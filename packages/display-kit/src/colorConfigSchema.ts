import {
  ConfigurationSchema,
  isCallbackValue,
  readConfObject,
} from '@jbrowse/core/configuration'
import { paletteFromSpec, rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { categoricalField, keyNames } from '@jbrowse/core/util/categoricalField'
import { darkAtLowEnd } from '@jbrowse/core/util/colorRamp'
import {
  CATEGORICAL_FIELD_PRESETS,
  FEATURE_FIELD_PRESETS,
  IDENTITY_SCALE,
  fieldScaleOf,
  paintedScale,
  withPreset,
} from '@jbrowse/core/util/colorScale'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { thresholdField } from '@jbrowse/core/util/thresholdScale'
import { types } from '@jbrowse/mobx-state-tree'

import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from '@jbrowse/core/configuration'
import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type {
  ColorScaleName,
  ColorSlots,
  FieldPresets,
} from '@jbrowse/core/util/colorScale'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type {
  ColorEncoding,
  ContinuousRef,
} from '@jbrowse/core/util/markEncoding'

export {
  CATEGORICAL_FIELD_PRESETS,
  COLOR_SCALES,
  FEATURE_FIELD_PRESETS,
  IDENTITY_SCALE,
  paintedScale,
  presetOf,
  withPreset,
} from '@jbrowse/core/util/colorScale'
export type {
  ColorScaleName,
  FieldPreset,
  FieldPresets,
} from '@jbrowse/core/util/colorScale'

/** The scales of a colour object whose field takes a range colour per value. */
export const CATEGORICAL_COLOR_SCALES = ['none', 'categorical'] as const

/** The scales of a colour object whose field paints one of a set of colours: a range colour per value, or per bin. */
export const DISCRETE_COLOR_SCALES = [
  ...CATEGORICAL_COLOR_SCALES,
  'threshold',
] as const

/** The scales FeatureColor paints: a range colour per value or per bin, a ramp, or each feature's own colour. */
export const FEATURE_COLOR_SCALES = [
  ...DISCRETE_COLOR_SCALES,
  'linear',
  'log',
  IDENTITY_SCALE,
] as const

/**
 * A colour object as written: the members every one declares, and the ones a
 * linear or log scale adds on the displays that declare them.
 */
export interface ColorSetting {
  value: string | undefined
  field: string
  scale: ColorScaleName | undefined
  domain: readonly string[]
  range: readonly string[]
  scheme?: ColorSchemeName | undefined
  reverse?: boolean
  domainMin?: number | undefined
  domainMax?: number | undefined
  domainMid?: number | undefined
  domainQuantile?: number
  labels?: readonly string[]
  title?: string | undefined
}

const PAINTED_SLOTS = [
  'field',
  'scale',
  'domain',
  'range',
  'scheme',
  'reverse',
  'domainMin',
  'domainMax',
  'domainMid',
  'domainQuantile',
] as const

type PaintedSlot = 'value' | (typeof PAINTED_SLOTS)[number]

type SchemaOf<C> = ConfigurationSchemaForModel<C>

/** The members {@link colorSettingOf} reads off `C`: the painted ones its schema declares. */
export type ColorSettingOf<C> = {
  [
    K in PaintedSlot & ConfigurationSlotName<SchemaOf<C>>
  ]: ConfigurationSlotValue<SchemaOf<C>, K>
}

/**
 * A colour object's painted members as written, the ones its schema declares:
 * `value` raw, so a `jexl:` callback reaches the display unevaluated, then the
 * field and every scale member. A display that reads the key's `labels` or
 * `title` spreads them on top, so renaming a key entry re-reads nothing that
 * paints.
 */
export function colorSettingOf<C extends AnyConfigurationModel>(
  color: C,
): ColorSettingOf<C> {
  const node: AnyConfigurationModel = color
  const setting: Record<string, unknown> = { value: node.value }
  for (const slot of PAINTED_SLOTS) {
    if (slot in node) {
      setting[slot] = readConfObject(node, slot)
    }
  }
  return setting as ColorSettingOf<C>
}

/**
 * What every channel object checks on the way in, `name` being the setting's
 * key: a `domain` or `range` is a list, and a `domain`, `breaks` or `labels`
 * written as numbers is carried as strings. No combination of slots is refused, since the config
 * editor writes one slot at a time: a `domain` with no `field`, or a `field`
 * under `none`, waits unread until it paints again.
 */
export function normalizeChannel(
  snap: Record<string, unknown> = {},
  name: string,
): Record<string, unknown> {
  for (const key of ['domain', 'range']) {
    if (snap[key] !== undefined && !Array.isArray(snap[key])) {
      throw new Error(`${name}.${key} is a list`)
    }
  }
  const out = { ...snap }
  for (const key of ['domain', 'breaks', 'labels']) {
    if (Array.isArray(out[key])) {
      out[key] = out[key].map(String)
    }
  }
  return out
}

/**
 * The mapping half of a colour object, spread beside the display's own
 * `value` slot: the field, and the scale it reads through. `scales` are the
 * members the display can paint. `fieldType` is `featureField` where the
 * display reads the field off each feature, a `jexl:` expression included,
 * and `string` where it names one of the display's own dimensions.
 */
export function colorChannelSlots<
  S extends ColorScaleName,
  F extends 'featureField' | 'string',
>({
  scales,
  scaleName,
  field,
  fieldType,
  fieldDefault = '',
  scale = 'how field paints; unset follows field, none paints value',
}: {
  scales: readonly S[]
  scaleName: string
  field: string
  fieldType: F
  fieldDefault?: string
  scale?: string
}) {
  return {
    field: {
      type: fieldType,
      defaultValue: fieldDefault,
      description: field,
    },
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration(scaleName, [...scales]),
      description: scale,
    },
  } as const
}

/** The values that matter to a categorical or threshold scale, in order. */
export function colorDomainSlot({
  domain = 'values that take the range first, in order',
}: {
  domain?: string
}) {
  return {
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: domain,
    },
  } as const
}

/** The colours a scale hands out, in order; empty is the display's default. */
export function colorRangeSlot({
  range = 'CSS colours the scale hands out, in order; empty is the default palette',
}: {
  range?: string
}) {
  return {
    range: {
      type: 'colorArray',
      defaultValue: [],
      description: range,
    },
  } as const
}

/**
 * What a value `domain` does not list takes, as d3's `ordinal.unknown`: unset,
 * the next palette colour where the display deals one; a colour, that colour;
 * `""`, no colour from this setting, so the value keeps its own. `range`
 * entries past the domain go unread while it is set.
 */
export const colorUnknownSlot = {
  unknown: {
    type: 'maybeColor',
    description:
      'what a value domain does not list takes: unset the next palette colour where the display deals one, a colour that colour, "" none from this setting',
  },
} as const

/** What a key names each `domain` value, one each in order. */
export const colorLabelsSlot = {
  labels: {
    type: 'stringArray',
    defaultValue: [],
    description:
      'what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name',
  },
} as const

/**
 * #slot title
 * The heading of the key this scale draws, naming what the colour measures.
 * Three states: unset, the key keeps the display's own heading, usually the
 * field's name; some text is that text; `""` is a key with no title, and the
 * only spelling of one. `null` reads as unset, as it does in every slot.
 */
export const colorTitleSlot = {
  title: {
    type: 'maybeString',
    description:
      'key title; unset keeps the display\'s own heading, "" draws none',
  },
} as const

/** The colour a `domain`/`range` pair list sets on each value it names. */
export function pairedColorsOf({
  domain,
  range,
}: {
  domain: readonly string[]
  range: readonly string[]
}): ReadonlyMap<string, string> {
  const colors = new Map<string, string>()
  domain.forEach((name, i) => {
    const color = range[i]
    if (color !== undefined) {
      colors.set(name, color)
    }
  })
  return colors
}

// A capture run sets `window.jbrowseRowPalette` before the app loads, to a
// palette name or a comma-separated colour list, and every row deal wraps
// through it in place of the row palette.
const dealtPaletteOverride = paletteFromSpec(
  (globalThis as { jbrowseRowPalette?: unknown }).jbrowseRowPalette,
)

function deckColorAt(position: number) {
  return dealtPaletteOverride
    ? dealtPaletteOverride[position % dealtPaletteOverride.length]!
    : rowPaletteColorAt(position)
}

/**
 * A colour for every value in `order`, as d3's ordinal scale over the row
 * palette deals them: a value `domain` lists takes its `range` entry, and
 * every other value, first seen first, takes the next entry of one cursor over
 * the `range` entries past the domain and then `rowPaletteColorAt`. A set
 * `unknown` takes the cursor's place: every other value takes it, or none
 * where it is `''`.
 */
export function dealRowColors(
  order: Iterable<string>,
  entries: {
    domain: readonly string[]
    range: readonly string[]
    unknown?: string
  },
): ReadonlyMap<string, string> {
  const colors = new Map(pairedColorsOf(entries))
  const { unknown } = entries
  if (unknown !== undefined) {
    if (unknown !== '') {
      for (const value of order) {
        if (!colors.has(value)) {
          colors.set(value, unknown)
        }
      }
    }
    return colors
  }
  const spare = entries.range.slice(entries.domain.length)
  let next = 0
  for (const value of order) {
    if (!colors.has(value)) {
      colors.set(
        value,
        next < spare.length ? spare[next]! : deckColorAt(next - spare.length),
      )
      next++
    }
  }
  return colors
}

/** A ramp's direction. */
export const colorReverseSlot = {
  reverse: {
    type: 'boolean',
    defaultValue: false,
    description:
      "turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain",
  },
} as const

/** What a linear or log scale adds: a named ramp, its direction, its middle. */
export const colorRampSlots = {
  scheme: {
    type: 'maybeStringEnum',
    model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
    description:
      "a named ramp for a linear or log scale; range's colours, where it lists any, win over it",
  },
  ...colorReverseSlot,
  domainMid: {
    type: 'maybeNumber',
    description:
      "the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end colour and equal distances from the middle take equal colours; unset, the stops are evenly spaced across it",
  },
} as const

/** A linear or log scale's two ends, each pinned or following the data. */
export const colorDomainEndsSlots = {
  domainMin: {
    type: 'maybeNumber',
    description:
      "the bottom of a linear or log scale's domain; unset follows the loaded values",
  },
  domainMax: {
    type: 'maybeNumber',
    description:
      "the top of a linear or log scale's domain; unset follows the loaded values",
  },
} as const

/**
 * The quantile an open end of a linear or log colour scale follows over the
 * loaded values, the rule `scales.y.domainQuantile` names alike: 1 spans
 * their extremes, and below it each end is clipped at that quantile of the
 * values on its side of 0, so one spike no longer takes the whole ramp and a
 * ramp over MAPQ or GC spans the data rather than starting at 0.
 */
export const colorDomainQuantileSlot = {
  domainQuantile: {
    type: 'number',
    defaultValue: 1,
    description:
      'the quantile an open end of a linear or log scale follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own',
    advanced: true,
  },
} as const

/** A colour object's options: a bare string is its `value`, and an undeclared key is refused. */
export function colorChannelOptions(
  name: string,
  fieldPresets: FieldPresets = CATEGORICAL_FIELD_PRESETS,
) {
  return {
    shorthand: 'value',
    closed: true,
    fieldPresets,
    preProcessSnapshot: (snap: Record<string, unknown> | undefined) =>
      normalizeChannel(snap, name),
  }
}

function listed(values: readonly string[]) {
  return values.length > 0 ? [...values] : undefined
}

/** A colour that maps a field: every form of {@link ColorEncoding} but the constant. */
export type FieldColorEncoding = Exclude<ColorEncoding, string>

/**
 * What any display's colour object paints: its `value` while it names no
 * field or sits under `none`, which is `undefined` on an object whose `value`
 * may be unset, else the field through the scale it paints through, its
 * preset's where it writes none, with the members that scale reads under the
 * names the config spells them, the preset's where the config leaves one
 * unwritten. Each scale answers one fixed set of keys, absent members
 * `undefined`, so a fetch key built over it compares alike whichever members a
 * config happens to write.
 */
export function colorEncodingOf<V extends string | undefined>(
  written: ColorSetting & { value: V },
  presets: FieldPresets = CATEGORICAL_FIELD_PRESETS,
): V | FieldColorEncoding {
  const color = withPreset(written, presets)
  const { field } = color
  const scale = paintedScale(color, fieldScaleOf(presets, field))
  switch (scale) {
    case 'none':
    case 'identity':
      return color.value
    case 'categorical':
      return {
        field,
        scale,
        domain: listed(color.domain),
        range: listed(color.range),
        labels: listed(color.labels ?? []),
      }
    case 'threshold':
      return {
        field,
        scale,
        domain: [...color.domain],
        range: listed(color.range),
        labels: listed(color.labels ?? []),
      }
    case 'linear':
    case 'log':
      return {
        field,
        scale,
        domainMin: color.domainMin,
        domainMax: color.domainMax,
        domainMid: color.domainMid,
        range: listed(color.range),
        scheme: color.scheme,
        reverse: color.reverse ?? false,
        domainQuantile: color.domainQuantile,
      }
  }
}

/**
 * A matrix display's colour object as it paints: its field through the
 * preset's ramp, with an unset `reverse` turning round a scheme dark at its
 * low end, since an unpainted cell is the page behind the matrix.
 */
export function matrixColorEncodingOf(
  written: Omit<ColorSetting, 'value' | 'domain' | 'range'>,
  presets: FieldPresets,
): ContinuousRef {
  const encoding = colorEncodingOf(
    { ...written, value: undefined, domain: [], range: [] },
    presets,
  ) as ContinuousRef
  const { scheme } = encoding
  return written.reverse === undefined && scheme !== undefined
    ? { ...encoding, reverse: darkAtLowEnd(scheme) }
    : encoding
}

/**
 * What a worker paints from: the encoding less the key's own names, so
 * renaming a key entry refetches nothing.
 */
export function paintedColorEncoding(
  encoding: ColorEncoding | undefined,
): ColorEncoding | undefined {
  if (typeof encoding !== 'object' || !('labels' in encoding)) {
    return encoding
  }
  const { labels: _labels, ...painted } = encoding
  return painted
}

/**
 * The rows an identity scale's key lists: each `domain` colour, named by its
 * `labels` entry. Only while each feature paints a colour of its own — `value`
 * unset, so a file's itemRgb, or a `jexl:` callback — since a constant paints
 * no colour for the key to name.
 */
export function identityKeyEntries({
  scale,
  value,
  domain,
  labels = [],
}: ColorSetting) {
  if (
    scale !== IDENTITY_SCALE ||
    (value !== undefined && !isCallbackValue(value))
  ) {
    return []
  }
  const names = keyNames(domain, labels)
  return domain.map(color => ({
    value: color,
    label: names.get(color) ?? color,
    color,
  }))
}

/** What a FeatureColor paints, each field through its preset where `scale` is unset. */
export function featureColorEncoding(color: ColorSetting) {
  return colorEncodingOf(color, FEATURE_FIELD_PRESETS)
}

function definedMembers(color: object) {
  return Object.fromEntries(
    Object.entries(color)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]),
  )
}

/**
 * The colour object a Color by pick writes over `current`. `''` paints
 * `value` and keeps the field and its members under `scale: 'none'` for the
 * way back; the field already named keeps its members and a declared scale;
 * a new field keeps only `value`. `none` takes the `scale` slot, so after the
 * way back the field paints through the display's default scale for it.
 */
export function colorForField(current: ColorSlots, field: string) {
  const kept = definedMembers(current)
  if (field === '') {
    return current.field ? { ...kept, scale: 'none' } : kept
  }
  if (field === current.field) {
    return {
      ...kept,
      scale: current.scale === 'none' ? undefined : current.scale,
    }
  }
  return definedMembers({ value: current.value, field })
}

/**
 * The colour object a Solid color pick writes over `current`: `value` paints,
 * undefined returning to each feature's own colour, and a field stays under
 * `scale: 'none'` for the way back.
 */
export function colorForValue(current: ColorSlots, value: string | undefined) {
  return definedMembers({
    ...current,
    value,
    ...(current.field ? { scale: 'none' } : {}),
  })
}

/**
 * A categorical encoding's field as every categorical channel keys, orders,
 * names and paints it, dealing its colours into `held` (`heldColorSlots`), or
 * `undefined` for any other encoding.
 */
export function categoricalColorField(
  encoding: ColorEncoding | undefined,
  held?: HeldSlots,
) {
  return typeof encoding === 'object' && encoding.scale === 'categorical'
    ? categoricalField(encoding.field, {
        domain: encoding.domain?.map(String),
        range: encoding.range,
        labels: encoding.labels,
        held,
      })
    : undefined
}

/**
 * The field a categorical or threshold encoding paints through, keyed,
 * ordered, named and coloured as every categorical channel reads one — a
 * threshold's values filed under their bins — or `undefined` for any other
 * encoding.
 */
export function colorFieldOf(
  encoding: ColorEncoding | undefined,
  held?: HeldSlots,
) {
  return typeof encoding === 'object' && encoding.scale === 'threshold'
    ? thresholdField(encoding.field, {
        domain: encoding.domain?.map(String),
        range: encoding.range,
        labels: encoding.labels,
      })
    : categoricalColorField(encoding, held)
}

/**
 * #config FeatureColor
 * #category display
 * The canvas feature displays' `color` setting: a CSS colour or `jexl:`
 * callback in `value`, or a field whose values each take a range colour,
 * whose numbers each take the colour of the interval between cut points they
 * fall in, or whose numbers run along a colour ramp, with a key. A string is
 * the constant; the object binds the field, and `scale: "none"` beside a
 * field paints the constant while keeping the field for the way back.
 * `scale: "identity"` leaves each feature its own colour, a file's itemRgb or
 * what a `value` callback returns, and names the colours `domain` lists in the
 * key.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', color: 'goldenrod' }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   color: { field: 'gene_biotype', range: ['#1f77b4', '#ff7f0e'] },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   color: {
 *     field: 'score',
 *     scale: 'threshold',
 *     domain: ['0.5', '0.9'],
 *     range: ['#c6dbef', '#6baed6', '#08519c'],
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   color: { field: 'score', scheme: 'viridis', domainMin: 0 },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   color: {
 *     scale: 'identity',
 *     domain: ['rgb(255,0,0)', 'rgb(0,128,0)'],
 *     labels: ['Active TSS', 'Strong transcription'],
 *   },
 * }
 * ```
 */
export const colorConfigSchema = ConfigurationSchema(
  'FeatureColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` returning one. Writing
     * `color: "red"` or `color: "jexl:…"` lands here. Unset, a feature's own
     * BED itemRgb paints it if it has one, else goldenrod.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS colour or jexl callback',
      contextVariable: ['feature'],
    },
    ...colorChannelSlots({
      scales: FEATURE_COLOR_SCALES,
      scaleName: 'FeatureColorScale',
      fieldType: 'featureField',
      field:
        "a feature field, or a jexl expression over feature, whose values each paint one range colour with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless domain or range says otherwise",
      scale:
        "none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; linear or log a colour along a ramp from domainMin to domainMax; identity paints each feature's own colour, as none does, and the key names the colours in domain; unset is linear for score and categorical for any other field",
    }),
    ...colorDomainSlot({
      domain:
        'the values that take the range first, in order; a value left out takes a colour no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it. Under identity, the CSS colours the key names, in order',
    }),
    ...colorRangeSlot({
      range:
        "CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts; under linear or log the ramp's stops, winning over scheme",
    }),
    ...colorLabelsSlot,
    ...colorRampSlots,
    ...colorDomainEndsSlots,
    ...colorDomainQuantileSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('color', FEATURE_FIELD_PRESETS),
)
