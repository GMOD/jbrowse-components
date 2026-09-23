import { preProcessConfigSnapshot } from '@jbrowse/core/configuration'
import { compareStructural } from 'mobx'

import { normalizeChannel, paintedScale } from './colorConfigSchema.ts'
import { facetConfigSchema } from './facetConfigSchema.ts'
import { rowsConfigSchema } from './rowsConfigSchema.ts'

import type { ColorSetting } from './colorConfigSchema.ts'

/**
 * A display's grouping, rows, color and filter as "Edit as JSON..." shows
 * them: `facet`, `rows` and `color` are the display's own settings, in the
 * shape their config objects take, and `filter` is the runtime jexl list of
 * Filter by.... A channel the spec leaves out is left as it is, and `null`
 * clears one.
 */
export interface ChannelSpec {
  facet?: { field: string; domain?: string[] } | null
  rows?: { field: string; domain?: string[] } | null
  color?: ColorChannel | null
  filter?: string[] | null
}

/**
 * A string is a constant: a CSS color, or a `jexl:` callback. An object binds
 * a field to a scale — the display's own list, `categorical` where it declares
 * nothing else — with the members the config spells: `domain` spending the
 * `range` or naming the cut points, and a linear or log scale's ends, middle,
 * `scheme` and `reverse`.
 */
export type ColorChannel =
  | string
  | {
      field: string
      scale?: string
      domain?: string[]
      range?: string[]
      scheme?: string
      reverse?: boolean
      domainMin?: number
      domainMax?: number
      domainMid?: number
    }

export const CHANNELS = ['facet', 'rows', 'color', 'filter'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(String) : undefined
}

function parseKeyed(
  name: 'facet' | 'rows',
  schema: typeof facetConfigSchema | typeof rowsConfigSchema,
  value: unknown,
) {
  if (value === null) {
    return null
  }
  const { field, domain } = preProcessConfigSnapshot(schema, value)
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(
      `${name} is a field name or { "field": …, "domain": [...] }`,
    )
  }
  const order = strings(domain)
  return { field: field.trim(), ...(order?.length ? { domain: order } : {}) }
}

// Every member any display's colour object declares, so one spec language
// reaches all of them; which of these a display declares is
// `colorSpecProblems`, off its own schema.
const COLOR_MEMBERS = [
  'value',
  'field',
  'scale',
  'domain',
  'range',
  'scheme',
  'reverse',
  'domainMin',
  'domainMax',
  'domainMid',
]

const NUMBER_MEMBERS = ['domainMin', 'domainMax', 'domainMid'] as const

function numberMember(lifted: Record<string, unknown>, key: string) {
  const value = lifted[key]
  if (value === undefined) {
    return {}
  }
  const n = Number(value)
  if (!Number.isFinite(n)) {
    throw new Error(`color.${key} is a number`)
  }
  return { [key]: n }
}

function parseColor(value: unknown): ChannelSpec['color'] {
  if (value === null) {
    return null
  }
  const given = typeof value === 'string' ? { value } : value
  if (!isRecord(given)) {
    throw new Error(
      'color is a CSS color, a jexl: expression or { "field": … }',
    )
  }
  const unknown = Object.keys(given).filter(k => !COLOR_MEMBERS.includes(k))
  if (unknown.length) {
    throw new Error(
      `color takes ${COLOR_MEMBERS.join(', ')}, not ${unknown.join(', ')}`,
    )
  }
  const lifted = normalizeChannel(given, 'color')
  const field = typeof lifted.field === 'string' ? lifted.field.trim() : ''
  const scale = typeof lifted.scale === 'string' ? lifted.scale : undefined
  if (paintedScale({ scale, field }, 'categorical') !== 'none') {
    const domain = strings(lifted.domain)
    const range = strings(lifted.range)
    const { scheme, reverse } = lifted
    if (scheme !== undefined && typeof scheme !== 'string') {
      throw new Error('color.scheme is the name of a ramp')
    }
    if (reverse !== undefined && typeof reverse !== 'boolean') {
      throw new Error('color.reverse is true or false')
    }
    return {
      field,
      ...(scale ? { scale } : {}),
      ...(domain?.length ? { domain } : {}),
      ...(range?.length ? { range } : {}),
      ...(scheme ? { scheme } : {}),
      ...(reverse ? { reverse } : {}),
      ...Object.assign(
        {},
        ...NUMBER_MEMBERS.map(key => numberMember(lifted, key)),
      ),
    }
  }
  if (typeof lifted.value !== 'string' || !lifted.value.trim()) {
    throw new Error(
      'color is a CSS color, a jexl: expression or { "field": … }',
    )
  }
  return lifted.value.trim()
}

/**
 * What a spec's colour asks for that this display cannot paint. `scales` is
 * the display's own `scale` enum and `members` its colour object's slots, both
 * read off its schema, so a spec is held to the set a config file is held to.
 */
export function colorSpecProblems(
  spec: ChannelSpec,
  {
    scales,
    members,
  }: { scales: readonly string[]; members: readonly string[] },
): string[] {
  const { color } = spec
  if (typeof color !== 'object' || !color) {
    return []
  }
  const problems: string[] = []
  const { scale } = color
  if (scale !== undefined && !scales.includes(scale)) {
    problems.push(
      `color: this display paints ${scales.join(', ')}, not ${scale}`,
    )
  }
  const undeclared = Object.keys(color).filter(k => !members.includes(k))
  if (undeclared.length) {
    problems.push(
      `color: this display takes ${members.join(', ')}, not ${undeclared.join(', ')}`,
    )
  }
  return problems
}

/**
 * A colour object as "Edit as JSON..." shows it: the string form for a
 * constant, and each member as written, a list only where it lists
 * something, so a round trip through the box changes nothing on its own.
 */
export function colorSpecOf(color: ColorSetting): ChannelSpec['color'] {
  if (paintedScale(color, 'categorical') === 'none') {
    return color.value ?? null
  }
  const {
    field,
    scale,
    domain,
    range,
    scheme,
    reverse,
    domainMin,
    domainMax,
    domainMid,
  } = color
  return {
    field,
    ...(scale ? { scale } : {}),
    ...(domain.length ? { domain: [...domain] } : {}),
    ...(range.length ? { range: [...range] } : {}),
    ...(scheme ? { scheme } : {}),
    ...(reverse ? { reverse } : {}),
    ...(domainMin === undefined ? {} : { domainMin }),
    ...(domainMax === undefined ? {} : { domainMax }),
    ...(domainMid === undefined ? {} : { domainMid }),
  }
}

function parseFilter(value: unknown): ChannelSpec['filter'] {
  if (value === null) {
    return null
  }
  const list = typeof value === 'string' ? [value] : value
  if (
    !Array.isArray(list) ||
    !list.every(item => typeof item === 'string' && item.trim())
  ) {
    throw new Error('filter is a jexl expression, or a list of them')
  }
  return list.map(item => item.trim())
}

/**
 * Throws a message naming the channel at fault, so the box can show it
 * under the text as it is typed. `facet` and `color` go through the lift and
 * the checks their config objects apply on load, so what the box accepts is
 * what a config file may hold.
 */
export function parseChannelSpec(text: string): ChannelSpec {
  const value: unknown = JSON.parse(text)
  if (!isRecord(value)) {
    throw new Error('A spec is one JSON object: { "color": …, "facet": … }')
  }
  const unknown = Object.keys(value).filter(
    key => !(CHANNELS as readonly string[]).includes(key),
  )
  if (unknown.length) {
    throw new Error(
      `The channels are ${CHANNELS.join(', ')}, not ${unknown.join(', ')}`,
    )
  }
  return {
    ...('facet' in value
      ? { facet: parseKeyed('facet', facetConfigSchema, value.facet) }
      : {}),
    ...('rows' in value
      ? { rows: parseKeyed('rows', rowsConfigSchema, value.rows) }
      : {}),
    ...('color' in value ? { color: parseColor(value.color) } : {}),
    ...('filter' in value ? { filter: parseFilter(value.filter) } : {}),
  }
}

/**
 * The channels a spec changes against the display's current ones: those it
 * names with a different value, split into the ones it sets and clears.
 */
export function channelSpecChanges(spec: ChannelSpec, current: ChannelSpec) {
  const changed = CHANNELS.filter(
    c => spec[c] !== undefined && !compareStructural(spec[c], current[c]),
  )
  return {
    sets: changed.filter(c => spec[c] !== null),
    clears: changed.filter(c => spec[c] === null),
  }
}
