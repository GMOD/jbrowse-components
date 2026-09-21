import {
  ConfigurationSchema,
  getSlotDefinition,
  slotChoices,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { ColorScaleName } from './colorScale.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export { COLOR_SCALES, paintedScale } from './colorScale.ts'
export type { ColorScaleName } from './colorScale.ts'

/** The scales of a colour object whose field takes a palette colour per value. */
export const CATEGORICAL_COLOR_SCALES = ['none', 'categorical'] as const

/** The `color` object as written: a constant, or a field through a categorical scale. */
export interface ColorSetting {
  value: string | undefined
  field: string
  scale: 'none' | 'categorical' | undefined
  domain: readonly string[]
  palette: readonly string[]
}

/** A colour object carrying every member any display declares. */
export interface FullColorSetting extends Omit<ColorSetting, 'scale'> {
  scale: ColorScaleName | undefined
  ramp: readonly string[]
  domainMid: number | undefined
}

/**
 * What every channel object checks on the way in, `name` being the setting's
 * key: a `domain` or `palette` is a list, and a `domain` written as numbers is
 * carried as strings. No combination of slots is refused, since the config
 * editor writes one slot at a time: a `domain` with no `field`, or a `field`
 * under `none`, waits unread until it paints again.
 */
export function normalizeChannel(
  snap: Record<string, unknown> = {},
  name: string,
): Record<string, unknown> {
  for (const key of ['domain', 'palette']) {
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
 * `value` slot: the field, the scale it reads through and the order its
 * values take. `scales` are the members the display can paint.
 */
export function colorChannelSlots<S extends ColorScaleName>({
  scales,
  scaleName,
  field,
  scale = 'how field paints; unset follows field, none paints value',
  domain = 'values that take the palette first, in order',
}: {
  scales: readonly S[]
  scaleName: string
  field: string
  scale?: string
  domain?: string
}) {
  return {
    field: {
      type: 'string',
      defaultValue: '',
      description: field,
    },
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration(scaleName, [...scales]),
      description: scale,
    },
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: domain,
    },
  } as const
}

/** The colours a scale hands `domain`, in order; empty is the default palette. */
export const colorPaletteSlot = {
  palette: {
    type: 'stringArray',
    defaultValue: [],
    description:
      'CSS colors the domain takes, in order, continuing into the default palette past its end',
  },
} as const

/** A linear or log scale's ramp: `["viridis"]`, or CSS colour stops spaced evenly. */
export const colorRampSlot = {
  ramp: {
    type: 'stringArray',
    defaultValue: [],
    description: 'viridis, or two or more CSS colour stops; empty is viridis',
  },
  domainMid: {
    type: 'maybeNumber',
    description:
      "the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it",
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

/** A colour object's options: a bare string is its `value`, and an undeclared key is refused. */
export function colorChannelOptions(name: string) {
  return {
    shorthand: 'value',
    closed: true,
    preProcessSnapshot: (snap: Record<string, unknown> | undefined) =>
      normalizeChannel(snap, name),
  }
}

/**
 * #config FeatureColor
 * #category display
 * The canvas feature displays' `color` setting: a CSS colour or `jexl:`
 * callback in `value`, or a field whose values each take a palette colour,
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
 *   color: { field: 'gene_biotype', palette: ['#1f77b4', '#ff7f0e'] },
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
      field:
        "a feature field, or a jexl expression over feature, whose values each paint one palette colour with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless domain or palette says otherwise",
      scale:
        'none paints value and keeps the field for a switch back; categorical a palette colour per value of field; unset follows field',
      domain:
        'the values that take the palette first, in order; a value left out keeps a colour derived from itself that no listed value paints, so every region agrees on it',
    }),
    ...colorPaletteSlot,
  },
  colorChannelOptions('color'),
)
