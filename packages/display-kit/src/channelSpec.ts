import { preProcessConfigSnapshot } from '@jbrowse/core/configuration'
import { compareStructural } from 'mobx'

import { normalizeChannel, paintedScale } from './colorConfigSchema.ts'
import { facetConfigSchema } from './facetConfigSchema.ts'

/**
 * A display's grouping, color and filter as "Edit as JSON..." shows them:
 * `facet` and `color` are the display's own settings, in the shape their
 * config objects take, and `filter` is the runtime jexl list of Filter by....
 * A channel the spec leaves out is left as it is, and `null` clears one.
 */
export interface ChannelSpec {
  facet?: { field: string; domain?: string[] } | null
  color?: ColorChannel | null
  filter?: string[] | null
}

/**
 * A string is a constant: a CSS color, or a `jexl:` callback. An object binds
 * a field to a scale — the display's own list, `categorical` where it declares
 * nothing else — with `domain` spending the `palette` or naming the cut
 * points, and `ramp` and `domainMid` the continuous scales' colours.
 */
export type ColorChannel =
  | string
  | {
      field: string
      scale?: string
      domain?: string[]
      palette?: string[]
      ramp?: string[]
      domainMid?: number
    }

export const CHANNELS = ['facet', 'color', 'filter'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(String) : undefined
}

function parseFacet(value: unknown): ChannelSpec['facet'] {
  if (value === null) {
    return null
  }
  const { field, domain } = preProcessConfigSnapshot(facetConfigSchema, value)
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error('facet is a field name or { "field": …, "domain": [...] }')
  }
  const order = strings(domain)
  return { field: field.trim(), ...(order?.length ? { domain: order } : {}) }
}

// Every member any display's colour object declares, so one spec language
// reaches all of them; which of these a display paints is `colorSpecProblems`.
const COLOR_MEMBERS = [
  'value',
  'field',
  'scale',
  'domain',
  'palette',
  'ramp',
  'domainMid',
]

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
    const palette = strings(lifted.palette)
    const ramp = strings(lifted.ramp)
    const domainMid =
      lifted.domainMid === undefined ? undefined : Number(lifted.domainMid)
    if (domainMid !== undefined && !Number.isFinite(domainMid)) {
      throw new Error('color.domainMid is a number')
    }
    return {
      field,
      ...(scale ? { scale } : {}),
      ...(domain?.length ? { domain } : {}),
      ...(palette?.length ? { palette } : {}),
      ...(ramp?.length ? { ramp } : {}),
      ...(domainMid === undefined ? {} : { domainMid }),
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
 * the display's own `scale` enum, read off the slot, so a spec is held to the
 * set a config file is held to — and a ramp is only ever read through a
 * continuous scale, so a display with none declines one.
 */
export function colorSpecProblems(
  spec: ChannelSpec,
  scales: readonly string[],
): string[] {
  const { color } = spec
  if (typeof color !== 'object' || !color) {
    return []
  }
  const problems: string[] = []
  const { scale, ramp, domainMid } = color
  if (scale !== undefined && !scales.includes(scale)) {
    problems.push(
      `color: this display paints ${scales.join(', ')}, not ${scale}`,
    )
  }
  const continuous = scales.includes('linear') || scales.includes('log')
  if (!continuous && (ramp !== undefined || domainMid !== undefined)) {
    problems.push(
      'color: this display has no ramp scale to read a ramp through',
    )
  }
  return problems
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
    throw new Error('A spec is one JSON object: { "facet": …, "color": … }')
  }
  const unknown = Object.keys(value).filter(
    key => !(CHANNELS as readonly string[]).includes(key),
  )
  if (unknown.length) {
    throw new Error(
      `The channels are facet, color and filter, not ${unknown.join(', ')}`,
    )
  }
  return {
    ...('facet' in value ? { facet: parseFacet(value.facet) } : {}),
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
