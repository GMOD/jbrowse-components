import { compareStructural } from 'mobx'

/**
 * A display's grouping, color and filter written as grammar-of-graphics
 * channels, in the words the mark display's config uses: `facet` stacks one
 * section per value of a field, `color` paints by a field or a constant, and
 * `filter` keeps the features its jexl expressions pass. A channel the spec
 * leaves out is left as it is, and `null` clears one.
 */
export interface ChannelSpec {
  facet?: { field: string; domain?: string[] } | null
  color?: { field: string } | { value: string } | null
  filter?: string[] | null
}

export const CHANNELS = ['facet', 'color', 'filter'] as const

type Channel = (typeof CHANNELS)[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fieldName(channel: Channel, value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${channel}.field names a field, as a non-empty string`)
  }
  return value.trim()
}

function onlyKeys(channel: Channel, obj: object, keys: string[]) {
  const extra = Object.keys(obj).filter(key => !keys.includes(key))
  if (extra.length) {
    throw new Error(
      `${channel} takes ${keys.join(' and ')}, not ${extra.join(', ')}`,
    )
  }
}

function parseFacet(value: unknown): ChannelSpec['facet'] {
  if (value === null) {
    return null
  }
  if (typeof value === 'string') {
    return { field: fieldName('facet', value) }
  }
  if (!isRecord(value)) {
    throw new Error('facet is a field name or { "field": …, "domain": [...] }')
  }
  onlyKeys('facet', value, ['field', 'domain'])
  const { field, domain } = value
  if (domain !== undefined && !Array.isArray(domain)) {
    throw new Error('facet.domain lists values in the order they stack')
  }
  return {
    field: fieldName('facet', field),
    ...(domain === undefined ? {} : { domain: domain.map(String) }),
  }
}

function parseColor(value: unknown): ChannelSpec['color'] {
  if (value === null) {
    return null
  }
  if (typeof value === 'string') {
    return { field: fieldName('color', value) }
  }
  if (!isRecord(value)) {
    throw new Error('color is a field name, { "field": … } or { "value": … }')
  }
  onlyKeys('color', value, ['field', 'value'])
  if ((value.field === undefined) === (value.value === undefined)) {
    throw new Error('color takes one of field and value')
  }
  if (value.field !== undefined) {
    return { field: fieldName('color', value.field) }
  }
  if (typeof value.value !== 'string' || !value.value.trim()) {
    throw new Error('color.value is a CSS color or a jexl: expression')
  }
  return { value: value.value.trim() }
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
 * under the text as it is typed.
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
