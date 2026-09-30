import type { MarkLegendSection, ScaledChannel } from './legend.ts'

/**
 * A key whose unlisted values hash onto one colour or shape: which values
 * share one, and the domain that would give each its own.
 */
export interface SharedKey {
  markIndexes: number[]
  channel: ScaledChannel
  /** Each set of values painted alike, in the key's order. */
  shared: string[][]
  /** The declared domain followed by every value the key lists that it does not. */
  pinned: string[]
}

/**
 * The keys whose values collide, from the legend's unioned sections: a
 * categorical colour or a shape scale with two or more values outside its
 * `domain` on one swatch, since an unlisted value takes a slot derived from
 * itself and two values can derive one. A listed value has a slot of its own.
 */
export function sharedKeysOf(sections: MarkLegendSection[]): SharedKey[] {
  return sections.flatMap(({ markIndexes, channel, scale }) => {
    const keyed:
      | { entries: [value: string, swatch: string][]; domain: string[] }
      | undefined =
      scale.kind === 'categorical'
        ? {
            entries: scale.entries.map(e => [e.value, String(e.color)]),
            domain: scale.domain,
          }
        : scale.kind === 'shape'
          ? {
              entries: scale.entries.map(e => [e.value, e.shape]),
              domain: scale.domain,
            }
          : undefined
    if (!keyed) {
      return []
    }
    const { entries, domain } = keyed
    const listed = new Set(domain)
    const bySwatch = new Map<string, string[]>()
    for (const [value, swatch] of entries) {
      if (value !== '') {
        bySwatch.set(swatch, [...(bySwatch.get(swatch) ?? []), value])
      }
    }
    const shared = [...bySwatch.values()].filter(
      values => values.length > 1 && values.some(v => !listed.has(v)),
    )
    return shared.length > 0
      ? [
          {
            markIndexes,
            channel,
            shared,
            pinned: [
              ...domain,
              ...entries.flatMap(([value]) =>
                value !== '' && !listed.has(value) ? [value] : [],
              ),
            ],
          },
        ]
      : []
  })
}

function quoted(values: readonly string[]) {
  const names = values.map(v => JSON.stringify(v))
  return names.length === 2
    ? names.join(' and ')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** The corner notice for a shared key, naming the menu item that lists the values. */
export function sharedKeyNotice({ markIndexes, channel, shared }: SharedKey) {
  const what = channel === 'color' ? 'colour' : 'shape'
  return `mark ${markIndexes.join(', ')} ${channel}: ${shared.map(quoted).join('; ')} share one ${what}, since a value the domain does not list takes a ${what} derived from itself; Pin distinct ${channel === 'color' ? 'colors' : 'shapes'} lists them`
}
