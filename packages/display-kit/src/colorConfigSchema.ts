import {
  ConfigurationSchema,
  getConfigurationSchemaDefinition,
  getSlotDefinition,
  slotChoices,
} from '@jbrowse/core/configuration'
import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { types } from '@jbrowse/mobx-state-tree'

import { paintedScale } from './colorScale.ts'

import type { ColorScaleName } from './colorScale.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

export { COLOR_SCALES, paintedScale } from './colorScale.ts'
export type { ColorScaleName } from './colorScale.ts'

/** The scales of a colour object whose field takes a range colour per value. */
export const CATEGORICAL_COLOR_SCALES = ['none', 'categorical'] as const

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
}

/**
 * What every channel object checks on the way in, `name` being the setting's
 * key: a `domain` or `range` is a list, and a `domain` written as numbers is
 * carried as strings. No combination of slots is refused, since the config
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
  return Array.isArray(snap.domain)
    ? { ...snap, domain: snap.domain.map(String) }
    : snap
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
  scale = 'how field paints; unset follows field, none paints value',
}: {
  scales: readonly S[]
  scaleName: string
  field: string
  fieldType: F
  scale?: string
}) {
  return {
    field: {
      type: fieldType,
      defaultValue: '',
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

/** What a linear or log scale adds: a named ramp, its direction, its middle. */
export const colorRampSlots = {
  scheme: {
    type: 'maybeStringEnum',
    model: types.enumeration('ColorScheme', [...COLOR_SCHEMES]),
    description:
      "a named ramp for a linear or log scale; range's colours, where it lists any, win over it",
  },
  reverse: {
    type: 'boolean',
    defaultValue: false,
    description:
      "turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain",
  },
  domainMid: {
    type: 'maybeNumber',
    description:
      "the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it",
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
 * The scales a display's colour object paints, read off its own slot, less
 * `none`, which the string form already is. What the Edit as JSON box offers
 * and holds a spec to.
 */
export function colorScaleChoicesOf(color: AnyConfigurationModel): string[] {
  return (slotChoices(getSlotDefinition(color, 'scale')) ?? []).filter(
    scale => scale !== 'none',
  )
}

/** The members a display's colour object declares, read off its schema. */
export function colorMembersOf(color: AnyConfigurationModel): string[] {
  return Object.keys(getConfigurationSchemaDefinition(color) ?? {})
}

/** A colour object's options: a bare string is its `value`, and an undeclared key is refused. */
export function colorChannelOptions(name: string) {
  return {
    shorthand: 'value',
    closed: true,
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
 * may be unset, else the field through the scale it paints through,
 * `fieldScale` where it writes none, with the members that scale reads under
 * the names the config spells them. Each scale answers one fixed set of keys,
 * absent members `undefined`, so a fetch key built over it compares alike
 * whichever members a config happens to write.
 */
export function colorEncodingOf<V extends string | undefined>(
  color: ColorSetting & { value: V },
  fieldScale: ColorScaleName,
): V | FieldColorEncoding {
  const { field } = color
  const scale = paintedScale(color, fieldScale)
  switch (scale) {
    case 'none':
      return color.value
    case 'categorical':
      return {
        field,
        scale,
        domain: listed(color.domain),
        range: listed(color.range),
      }
    case 'threshold':
      return {
        field,
        scale,
        domain: [...color.domain],
        range: listed(color.range),
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
      }
  }
}

interface PickableColor {
  value?: string
  field?: string
  scale?: string
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
export function colorForField(current: PickableColor, field: string) {
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
export function colorForValue(
  current: PickableColor,
  value: string | undefined,
) {
  return definedMembers({
    ...current,
    value,
    ...(current.field ? { scale: 'none' } : {}),
  })
}

/**
 * A categorical encoding's field as every categorical channel keys, orders,
 * names and paints it, or `undefined` for any other encoding.
 */
export function categoricalColorField(encoding: ColorEncoding | undefined) {
  return typeof encoding === 'object' && encoding.scale === 'categorical'
    ? categoricalField(encoding.field, {
        domain: encoding.domain?.map(String),
        range: encoding.range,
      })
    : undefined
}

/**
 * #config FeatureColor
 * #category display
 * The canvas feature displays' `color` setting: a CSS colour or `jexl:`
 * callback in `value`, or a field whose values each take a range colour,
 * with a key. A string is the constant; the object binds the field, and
 * `scale: "none"` beside a field paints the constant while keeping the field
 * for the way back.
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
      scales: CATEGORICAL_COLOR_SCALES,
      scaleName: 'FeatureColorScale',
      fieldType: 'featureField',
      field:
        "a feature field, or a jexl expression over feature, whose values each paint one range colour with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless domain or range says otherwise",
      scale:
        'none paints value and keeps the field for a switch back; categorical a range colour per value of field; unset follows field',
    }),
    ...colorDomainSlot({
      domain:
        'the values that take the range first, in order; a value left out keeps a colour derived from itself that no listed value paints, so every region agrees on it',
    }),
    ...colorRangeSlot({
      range:
        'CSS colours the domain takes, in order, continuing into the default palette past its end',
    }),
  },
  colorChannelOptions('color'),
)
