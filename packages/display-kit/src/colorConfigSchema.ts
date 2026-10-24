import {
  ConfigurationSchema,
  getConfigurationSchemaMetadata,
  isCallbackValue,
  readConfObject,
} from '@jbrowse/core/configuration'
import { paletteFromSpec, rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { categoricalField, keyNames } from '@jbrowse/core/util/categoricalField'
import {
  darkAtLowEnd,
  rampLutOf,
  stopsFromRampLut,
} from '@jbrowse/core/util/colorRamp'
import {
  CATEGORICAL_FIELD_PRESETS,
  FEATURE_FIELD_PRESETS,
  IDENTITY_SCALE,
  fieldScaleOf,
  paintedScale,
  withPreset,
} from '@jbrowse/core/util/colorScale'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { isCssColor } from '@jbrowse/core/util/cssColorParse'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { thresholdField } from '@jbrowse/core/util/thresholdScale'
import { isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

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

/** The scales of a color object whose field takes a range color per value. */
export const CATEGORICAL_COLOR_SCALES = ['ordinal'] as const

/** The scales of a color object whose field paints one of a set of colors: a range color per value, or per bin. */
export const DISCRETE_COLOR_SCALES = [
  ...CATEGORICAL_COLOR_SCALES,
  'threshold',
] as const

/** The scales FeatureColor paints: a range color per value or per bin, a ramp, or each feature's own color. */
export const FEATURE_COLOR_SCALES = [
  ...DISCRETE_COLOR_SCALES,
  'linear',
  'log',
  IDENTITY_SCALE,
] as const

/** A channel's `scale` as read off its node, each member its default where unwritten. */
export interface ColorScaleSetting {
  type: ColorScaleName | undefined
  domain: readonly string[]
  range: readonly string[]
  names?: readonly string[]
  scheme?: ColorSchemeName | undefined
  reverse?: boolean
  domainMin?: number | undefined
  domainMax?: number | undefined
  domainMid?: number | undefined
  domainQuantile?: number
  unknown?: string | undefined
  invalid?: string | undefined
}

/** A channel's `legend` as read off its node. */
export interface ColorLegendSetting {
  title?: string | undefined
  descending?: boolean
}

/**
 * A color channel as read off its node: the constant, the field, the scale
 * and the key, the members a display declares and their defaults.
 */
export interface ColorSetting {
  value: string | undefined
  field: string
  scale: ColorScaleSetting
  legend: ColorLegendSetting
}

// What paints, as opposed to what the key names: `names` and `legend` are
// read only by `colorSnapshotOf`, so renaming a key entry re-reads nothing
// that paints.
const PAINTED_SCALE_SLOTS = [
  'type',
  'domain',
  'range',
  'unknown',
  'invalid',
  'scheme',
  'reverse',
  'domainMin',
  'domainMax',
  'domainMid',
  'domainQuantile',
] as const

type PaintedScaleSlot = (typeof PAINTED_SCALE_SLOTS)[number]

type SchemaOf<C> = ConfigurationSchemaForModel<C>

type SlotsOf<N, K extends string> = {
  [S in K & ConfigurationSlotName<SchemaOf<N>>]: ConfigurationSlotValue<
    SchemaOf<N>,
    S
  >
}

type PartOf<C, K extends string> = C extends Record<K, infer N> ? N : never

/**
 * The members {@link colorSettingOf} reads off `C`: the painted ones its
 * schema declares, or every one where `C` is an untyped node.
 */
export type ColorSettingOf<C> = 0 extends 1 & C
  ? ColorSetting
  : SlotsOf<C, 'value' | 'field'> & {
      scale: SlotsOf<PartOf<C, 'scale'>, PaintedScaleSlot>
      legend: ColorLegendSetting
    }

function partOf(node: AnyConfigurationModel, name: 'scale' | 'legend') {
  const part: unknown = node[name]
  return isStateTreeNode(part) ? (part as AnyConfigurationModel) : undefined
}

function slotsOf(
  node: AnyConfigurationModel | undefined,
  names: readonly string[],
) {
  const out: Record<string, unknown> = {}
  if (node) {
    for (const name of names) {
      if (name in node) {
        out[name] = readConfObject(node, name)
      }
    }
  }
  return out
}

/**
 * A color channel's painted members as written, the ones its schema declares:
 * `value` raw, so a `jexl:` callback reaches the display unevaluated, then the
 * field and every painted scale member. A display that reads the key's
 * `scale.names` or `legend` spreads them on top (`colorSnapshotOf`), so
 * renaming a key entry re-reads nothing that paints.
 */
export function colorSettingOf<C extends AnyConfigurationModel>(
  color: C,
): ColorSettingOf<C> {
  const node: AnyConfigurationModel = color
  return {
    value: node.value,
    ...slotsOf(node, ['field']),
    scale: slotsOf(partOf(node, 'scale'), PAINTED_SCALE_SLOTS),
    legend: {},
  } as unknown as ColorSettingOf<C>
}

/**
 * The field `color`'s schema maps while the object names neither a field nor
 * a constant (`colorChannelOptions`' `impliedField`), for `withImpliedField`.
 */
export function impliedFieldOf(
  color: AnyConfigurationModel,
): string | undefined {
  return getConfigurationSchemaMetadata(color)?.options.impliedField
}

/** {@link colorSettingOf} with the key's `scale.names` and `legend` spread on top. */
export function colorSnapshotOf<C extends AnyConfigurationModel>(color: C) {
  const setting = colorSettingOf(color)
  const node: AnyConfigurationModel = color
  return {
    ...setting,
    scale: {
      ...setting.scale,
      ...(slotsOf(partOf(node, 'scale'), ['names']) as {
        names?: readonly string[]
      }),
    },
    legend: slotsOf(partOf(node, 'legend'), [
      'title',
      'descending',
    ]) as ColorLegendSetting,
  }
}

/**
 * What every scale checks on the way in, `name` being its setting's path: a
 * `domain` or `range` is a list, and a `domain`, `names` or `values` written
 * as numbers is carried as strings. No combination of slots is refused, since
 * the config editor writes one slot at a time: a `domain` with no `field`
 * waits unread until a field paints again. The row and facet objects check
 * their own `sort` and `hidden` the same way.
 */
export function normalizeChannel(
  snap: Record<string, unknown> = {},
  name: string,
): Record<string, unknown> {
  for (const key of ['domain', 'sort', 'range', 'hidden']) {
    if (snap[key] !== undefined && !Array.isArray(snap[key])) {
      throw new Error(`${name}.${key} is a list`)
    }
  }
  const out = { ...snap }
  for (const key of ['domain', 'sort', 'names', 'values', 'hidden']) {
    if (Array.isArray(out[key])) {
      out[key] = out[key].map(String)
    }
  }
  return out
}

/**
 * A channel's field. `fieldType` is `featureField` where the display reads
 * the field off each feature, a `jexl:` expression included, and `string`
 * where it names one of the display's own dimensions.
 */
export function colorFieldSlot<F extends 'featureField' | 'string'>({
  field,
  fieldType,
  fieldDefault = '',
}: {
  field: string
  fieldType: F
  fieldDefault?: string
}) {
  return {
    field: {
      type: fieldType,
      defaultValue: fieldDefault,
      description: field,
    },
  } as const
}

/** A scale's `type`: the members of `scales` the display can paint. */
export function colorScaleTypeSlot<S extends ColorScaleName>({
  scales,
  scaleName,
  type = 'unset follows field',
}: {
  scales: readonly S[]
  scaleName: string
  type?: string
}) {
  return {
    type: {
      type: 'maybeStringEnum',
      model: types.enumeration(scaleName, [...scales]),
      description: type,
    },
  } as const
}

/**
 * @deprecated `colorFieldSlot` and `colorScaleTypeSlot`. A plugin bundling
 * `@jbrowse/synteny-core` or `display-kit` 5.0.0-beta.17 or older calls this
 * from the host.
 */
export function colorChannelSlots<
  S extends ColorScaleName,
  F extends 'featureField' | 'string',
>({
  scales,
  scaleName,
  field,
  fieldType,
  fieldDefault,
  scale,
}: {
  scales: readonly S[]
  scaleName: string
  field: string
  fieldType: F
  fieldDefault?: string
  scale?: string
}) {
  return {
    ...colorFieldSlot({ field, fieldType, fieldDefault }),
    scale: colorScaleTypeSlot({ scales, scaleName, type: scale }).type,
  } as const
}

/** The values that matter to an ordinal or threshold scale, in order. */
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

/** The colors a scale hands out, in order; empty is the display's default. */
export function colorRangeSlot({
  range = 'CSS colors the scale hands out, in order; empty is the default palette',
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
 * The color for a value missing from `domain`, as d3's `ordinal.unknown`: unset,
 * the next palette color where the display deals one; a color, that color;
 * `""`, no color from this setting, so a row keeps the color it already has, a
 * variant cell the alt hue, and a feature or mark the no-value grey. The key
 * lists every value it paints as one row, Other. On a display that declares
 * `invalid`, a feature with no value takes that instead. `range` entries past
 * the domain go unread while it is set.
 */
export const colorUnknownSlot = {
  unknown: {
    type: 'maybeColor',
    description:
      'color for a value missing from domain: unset takes the next palette color where the display deals one, a color paints that color, "" adds no color from this setting, so a row keeps the color it already has, a variant cell takes the alt hue and a feature the no-value grey',
  },
} as const

/**
 * The color for a feature with no value under an ordinal scale's field,
 * Vega-Lite's `invalid`: unset, the display's no-value color, the grey on a
 * feature or mark and the alt hue on a variant cell, or a preset's own
 * missing level (strand's `0`). Written as the `unknown` color, it files those
 * features with the values `domain` leaves out, one row, Other.
 */
export const colorInvalidSlot = {
  invalid: {
    type: 'maybeColor',
    description:
      "color for a feature with no value under an ordinal scale's field; unset, the display's no-value color",
  },
} as const

/** The key's name for each `domain` value, one each in order. */
export const colorNamesSlot = {
  names: {
    type: 'stringArray',
    defaultValue: [],
    description:
      'key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own',
  },
} as const

/** @deprecated `colorNamesSlot`; see `colorChannelSlots` */
export const colorLabelsSlot = { labels: colorNamesSlot.names } as const

/**
 * A threshold key's direction, the way a vertical stepped legend stands. A
 * color object declares it only where its display's key reads it.
 */
export const colorDescendingSlot = {
  descending: {
    type: 'maybeBoolean',
    description:
      "threshold key lists the highest interval first; unset follows the field's preset, else the lowest first",
  },
} as const

/**
 * #slot title
 * The heading of the key this scale draws, naming what the color measures.
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

/** The color a `domain`/`range` pair list sets on each value it names. */
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
// palette name or a comma-separated color list, and every row deal wraps
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
 * A color for every value in `order`, as d3's ordinal scale over the row
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
    type: 'maybeBoolean',
    description:
      "turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written",
  },
} as const

/** What a ramp adds: a named scheme, its direction, its middle. */
export const colorRampSlots = {
  scheme: {
    type: 'maybeStringEnum',
    model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
    description:
      "a named ramp: a linear, log or symlog scale runs along it, and a threshold that writes cuts takes one color per interval from end to end; range's colors, where it lists any, win over it",
  },
  ...colorReverseSlot,
  domainMid: {
    type: 'maybeNumber',
    description:
      "the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it",
  },
} as const

/** A ramp's two ends, each pinned or following the data. */
export const colorDomainEndsSlots = {
  domainMin: {
    type: 'maybeNumber',
    description:
      "the bottom of a ramp's domain; unset follows the loaded values",
  },
  domainMax: {
    type: 'maybeNumber',
    description: "the top of a ramp's domain; unset follows the loaded values",
  },
} as const

/**
 * The quantile an open end of a color ramp follows over the
 * loaded values: 1 spans their extremes, and below it each end is clipped at
 * that quantile of the values on its side of 0, so one spike no longer takes
 * the whole ramp and a ramp over GC spans the data rather than starting at 0.
 * A y scale's `fenceQuantile` names a looser rule, fencing an end at twice the
 * span its quantile draws, since an axis wants headroom past a spike and the
 * key shows what a saturated color stands for.
 */
export const colorDomainQuantileSlot = {
  domainQuantile: {
    type: 'number',
    defaultValue: 1,
    description:
      'the quantile an open end of a ramp follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own',
    advanced: true,
  },
} as const

/**
 * A word where a color object's constant goes is the field its writer meant,
 * so it is refused with the spelling of one rather than as no color.
 */
function refuseFieldAsConstant(
  snap: Record<string, unknown> | undefined,
  name: string,
) {
  const value = snap?.value
  if (
    typeof value === 'string' &&
    value !== '' &&
    !isJexl(value) &&
    !isCssColor(value)
  ) {
    throw new Error(
      `${name}: "${value}" is not a color. To color by the field, write ${name}: { "field": "${value}" }`,
    )
  }
  return snap
}

/**
 * A color where a channel's field goes is the constant its writer meant, as a
 * bare string inside `encoding` is the field, so it is refused with the
 * spelling of one rather than as a field no feature carries.
 */
function refuseConstantAsField(
  snap: Record<string, unknown> | undefined,
  name: string,
) {
  const field = snap?.field
  if (typeof field === 'string' && !isJexl(field) && isCssColor(field)) {
    throw new Error(
      `${name}: "${field}" is a color, and a bare string is the field. To paint every feature it, write ${name}: { "value": "${field}" }`,
    )
  }
  return snap
}

/**
 * A color channel's options: a bare string is its `field`, an undeclared key
 * is refused, and `impliedField` is the field the object maps while it names
 * neither a field nor a constant. A default on the `field` slot cannot stand
 * in for it: `{ value: 'red' }` would then paint the field.
 */
export function colorChannelOptions(
  name: string,
  fieldPresets: FieldPresets = CATEGORICAL_FIELD_PRESETS,
  { impliedField }: { impliedField?: string } = {},
) {
  return {
    shorthand: 'field' as const,
    writes: 'whole' as const,
    plot: true,
    closed: true,
    fieldPresets,
    ...(impliedField ? { impliedField } : {}),
    preProcessSnapshot: (snap: Record<string, unknown> = {}) =>
      refuseConstantAsField(refuseFieldAsConstant(snap, name), name) ?? {},
  }
}

/** A channel's `scale` sub-object's options, `name` its setting's path. */
export function colorScaleOptions(name: string) {
  return {
    closed: true,
    preProcessSnapshot: (
      snap: Record<string, unknown> | string | undefined,
    ) => {
      // the flat color's `scale: 'ordinal'`, written inside the channel
      if (typeof snap === 'string') {
        throw new Error(
          `${name} is an object: write ${name}: { "type": ${JSON.stringify(snap)} }`,
        )
      }
      return normalizeChannel(snap, name)
    },
  }
}

/** A channel's `legend` sub-object's options. */
export const colorLegendOptions = { closed: true } as const

/** A display's `encoding`, the namespace its channels sit in. */
export const encodingOptions = { closed: true, plot: true } as const

function listed(values: readonly string[]) {
  return values.length > 0 ? [...values] : undefined
}

/**
 * A threshold's colors where it writes cuts and no `range`: its `scheme`, the
 * written one or its field preset's, sampled one color per interval from end
 * to end. Without a scheme the display's own default colors stand.
 */
function thresholdRange(scale: ColorScaleSetting) {
  const listedRange = listed(scale.range)
  const { domain, scheme, reverse } = scale
  return (
    listedRange ??
    (domain.length > 0 && scheme !== undefined
      ? stopsFromRampLut(rampLutOf({ scheme, reverse }), domain.length + 1).map(
          stop => stop.color,
        )
      : undefined)
  )
}

/** A color that maps a field: every form of {@link ColorEncoding} but the constant. */
export type FieldColorEncoding = Exclude<ColorEncoding, string>

/**
 * What any display's color channel paints: its `value` while it names no
 * field, which is `undefined` on a channel whose `value` may be unset, else
 * the field through the scale it paints through, its preset's where it writes
 * none, with the members that scale reads, the preset's where the config
 * leaves one unwritten. Each scale answers one fixed set of keys, absent
 * members `undefined`, so a fetch key built over it compares alike whichever
 * members a config happens to write.
 */
export function colorEncodingOf<V extends string | undefined>(
  written: ColorSetting & { value: V },
  presets: FieldPresets = CATEGORICAL_FIELD_PRESETS,
): V | FieldColorEncoding {
  const color = withPreset(written, presets)
  const { field, scale: s } = color
  const scale = paintedScale(color, fieldScaleOf(presets, field))
  switch (scale) {
    case 'none':
    case 'identity':
      return color.value
    case 'ordinal':
      return {
        field,
        scale,
        domain: listed(s.domain),
        range: listed(s.range),
        names: listed(s.names ?? []),
        unknown: s.unknown,
        invalid: s.invalid,
      }
    case 'threshold':
      return {
        field,
        scale,
        domain: [...s.domain],
        range: thresholdRange(s),
        names: listed(s.names ?? []),
        descending: color.legend.descending,
      }
    case 'linear':
    case 'log':
    case 'symlog':
      return {
        field,
        scale,
        domainMin: s.domainMin,
        domainMax: s.domainMax,
        domainMid: s.domainMid,
        range: listed(s.range),
        scheme: s.scheme,
        reverse: s.reverse ?? false,
        domainQuantile: s.domainQuantile,
      }
  }
}

/**
 * A matrix display's color object as it paints: its field through the
 * preset's ramp, with an unset `reverse` turning round a scheme dark at its
 * low end, since an unpainted cell is the page behind the matrix.
 */
export function matrixColorEncodingOf(
  written: Omit<ColorSetting, 'value' | 'scale'> & {
    scale: Omit<ColorScaleSetting, 'domain' | 'range'>
  },
  presets: FieldPresets,
): ContinuousRef {
  const encoding = colorEncodingOf(
    {
      ...written,
      value: undefined,
      scale: { ...written.scale, domain: [], range: [] },
    },
    presets,
  ) as ContinuousRef
  const { scheme } = encoding
  return written.scale.reverse === undefined && scheme !== undefined
    ? { ...encoding, reverse: darkAtLowEnd(scheme) }
    : encoding
}

/**
 * What a worker paints from: the encoding less the key's own names and
 * direction, so renaming or turning a key round refetches nothing.
 */
export function paintedColorEncoding(
  encoding: ColorEncoding | undefined,
): ColorEncoding | undefined {
  if (typeof encoding !== 'object' || !('names' in encoding)) {
    return encoding
  }
  const {
    names: _names,
    descending: _descending,
    ...painted
  } = encoding as typeof encoding & { descending?: boolean }
  return painted
}

/**
 * The rows an identity scale's key lists: each `scale.domain` color, named by
 * its `scale.names` entry. Only while each feature paints a color of its own
 * — `value` unset, so a file's itemRgb, or a `jexl:` callback — since a
 * constant paints no color for the key to name.
 */
export function identityKeyEntries({ scale, value }: ColorSetting) {
  if (
    scale.type !== IDENTITY_SCALE ||
    (value !== undefined && !isCallbackValue(value))
  ) {
    return []
  }
  const names = keyNames(scale.domain, scale.names ?? [])
  return scale.domain.map(color => ({
    value: color,
    label: names.get(color) ?? color,
    color,
  }))
}

/** What a FeatureColor paints, each field through its preset where `scale.type` is unset. */
export function featureColorEncoding(color: ColorSetting) {
  return colorEncodingOf(color, FEATURE_FIELD_PRESETS)
}

function definedOf(part: object | undefined) {
  const out = Object.fromEntries(
    Object.entries(part ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]),
  )
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * `color` with its unset members dropped, and a `scale` or `legend` left
 * empty dropped too, so it compares alike with the snapshot of the object it
 * writes.
 */
export function definedColor(color: ColorSlots): ColorSlots {
  const { scale, legend, ...rest } = color
  return (
    definedOf({
      ...rest,
      scale: definedOf(scale),
      legend: definedOf(legend),
    }) ?? {}
  )
}

/**
 * The color object a Color by pick writes over `current`. `''` drops the field
 * and its scale and key, leaving `value`, and a fieldless identity scale,
 * which paints each feature's own color, black included; the field already
 * named keeps its scale and key; the field `parked` holds (`parkedColorOf`)
 * takes them back; a new field keeps only `value`.
 */
export function colorForField(
  current: ColorSlots,
  field: string,
  parked?: ColorSlots,
): ColorSlots {
  const { value } = current
  if (field === '') {
    const cleared = withoutField(current)
    return cleared.scale?.type === IDENTITY_SCALE
      ? definedColor({
          ...cleared,
          scale: { ...cleared.scale, type: undefined },
        })
      : cleared
  }
  if (field === current.field) {
    return definedColor(current)
  }
  return definedColor(
    field === parked?.field ? { ...parked, value } : { value, field },
  )
}

function withoutField(current: ColorSlots) {
  return definedColor(current.field ? { value: current.value } : current)
}

/**
 * The field a pick takes off `color`, with its scale and key, for
 * `colorForField` to give back; undefined while `color` names no field.
 */
export function parkedColorOf({
  value: _value,
  ...members
}: ColorSlots): ColorSlots | undefined {
  return members.field ? definedColor(members) : undefined
}

/**
 * The color object a scheme pick writes over `current`: the ramp named,
 * unset where it is `defaultScheme`, the one the object paints with anyway,
 * and `scale.reverse` and `scale.range` dropped, since either would turn or
 * replace the ramp picked.
 */
export function colorForScheme(
  current: ColorSlots,
  scheme: string,
  defaultScheme?: string,
): ColorSlots {
  const {
    scheme: _scheme,
    reverse: _reverse,
    range: _range,
    ...kept
  } = current.scale ?? {}
  return definedColor({
    ...current,
    scale: scheme === defaultScheme ? kept : { ...kept, scheme },
  })
}

/**
 * The color object a Solid color pick writes over `current`: `value` paints,
 * undefined returning to each feature's own color, and the field goes, since a
 * written field paints over any constant.
 */
export function colorForValue(
  current: ColorSlots,
  value: string | undefined,
): ColorSlots {
  return definedColor({ ...withoutField(current), value })
}

/**
 * An ordinal encoding's field as every ordinal channel keys, orders, names
 * and paints it, dealing its colors into `held` (`heldColorSlots`), or
 * `undefined` for any other encoding.
 */
export function categoricalColorField(
  encoding: ColorEncoding | undefined,
  held?: HeldSlots,
) {
  return typeof encoding === 'object' && encoding.scale === 'ordinal'
    ? categoricalField(encoding.field, {
        domain: encoding.domain?.map(String),
        range: encoding.range,
        labels: encoding.names,
        held,
        unknown: encoding.unknown,
        invalid: encoding.invalid,
      })
    : undefined
}

/**
 * The field an ordinal or threshold encoding paints through, keyed, ordered,
 * named and colored as every ordinal channel reads one — a threshold's values
 * filed under their bins — or `undefined` for any other encoding.
 */
export function colorFieldOf(
  encoding: ColorEncoding | undefined,
  held?: HeldSlots,
) {
  return typeof encoding === 'object' && encoding.scale === 'threshold'
    ? thresholdField(encoding.field, {
        domain: encoding.domain?.map(String),
        range: encoding.range,
        labels: encoding.names,
      })
    : categoricalColorField(encoding, held)
}

/**
 * #config FeatureColor
 * #category display
 * The canvas feature displays' `encoding.color`: a CSS color or `jexl:`
 * callback in `value`, or a field whose values each take a range color, whose
 * numbers each take the color of the interval between cut points they fall
 * in, or whose numbers run along a color ramp, with a key. A string is the
 * field; a written field always paints. `scale.type: "identity"` keeps each
 * feature's color, whether a file's itemRgb or what a `value` callback
 * returns, and names the colors `scale.domain` lists in the key. Like UCSC's
 * `itemRgb on`, it paints an itemRgb of `0,0,0` or `0` black, which otherwise
 * reads as no color, and reads a comma-free itemRgb as a packed integer.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', encoding: { color: { value: 'goldenrod' } } }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   encoding: {
 *     color: { field: 'gene_biotype', scale: { range: ['#1f77b4', '#ff7f0e'] } },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   encoding: {
 *     color: {
 *       field: 'type',
 *       scale: {
 *         domain: ['prophage', 'plasmid'],
 *         range: ['#d95f02', '#1b9e77'],
 *         unknown: '#cccccc',
 *       },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   encoding: {
 *     color: {
 *       field: 'score',
 *       scale: {
 *         type: 'threshold',
 *         domain: [0.5, 0.9],
 *         range: ['#c6dbef', '#6baed6', '#08519c'],
 *       },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   encoding: { color: { field: 'score', scale: { scheme: 'viridis', domainMin: 0 } } },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   encoding: {
 *     color: {
 *       scale: {
 *         type: 'identity',
 *         domain: ['rgb(255,0,0)', 'rgb(0,128,0)'],
 *         names: ['Active TSS', 'Strong transcription'],
 *       },
 *     },
 *   },
 * }
 * ```
 */
export const colorConfigSchema = ConfigurationSchema(
  'FeatureColor',
  {
    /**
     * #slot value
     * A CSS color, or a jexl callback over `feature` returning one. Unset, a
     * feature's own BED itemRgb paints it if it has one, else goldenrod.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color or jexl callback',
      contextVariable: ['feature'],
    },
    ...colorFieldSlot({
      fieldType: 'featureField',
      field:
        "a feature field, or a jexl expression over feature, whose values each take one range color, with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless scale.domain or scale.range says otherwise",
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'FeatureColorScale',
      {
        ...colorScaleTypeSlot({
          scales: FEATURE_COLOR_SCALES,
          scaleName: 'FeatureColorScaleType',
          type: "ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; linear or log a color along a ramp from domainMin to domainMax; identity paints each feature's own color, as a channel with no field does, except that an itemRgb of 0,0,0 or 0 paints black and a comma-free one reads as a packed integer, and the key names the colors in domain; unset is linear for score and ordinal for any other field",
        }),
        ...colorDomainSlot({
          domain:
            'the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it. Under identity, the CSS colors the key names, in order',
        }),
        ...colorRangeSlot({
          range:
            "CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts; under linear or log the ramp's stops, winning over scheme",
        }),
        ...colorUnknownSlot,
        ...colorInvalidSlot,
        ...colorNamesSlot,
        ...colorRampSlots,
        ...colorDomainEndsSlots,
        ...colorDomainQuantileSlot,
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws.
     */
    legend: ConfigurationSchema(
      'FeatureColorLegend',
      { ...colorTitleSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color', FEATURE_FIELD_PRESETS),
)
