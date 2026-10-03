import type { MarkLegendSection } from './legend.ts'

/**
 * A shape key whose unlisted values hash onto one shape: which values share
 * one, and the domain that would give each its own. Colours need no such key,
 * since a categorical colour deals each value its own (ADR-205).
 */
export interface SharedKey {
  markIndexes: number[]
  channel: 'shape'
  /** Each set of values drawn alike, in the key's order. */
  shared: string[][]
  /** The declared domain followed by every value the key lists that it does not. */
  pinned: string[]
}

/**
 * The shape keys whose values collide, from the legend's unioned sections:
 * two or more values outside the `domain` on one shape, since an unlisted
 * value takes a shape derived from itself and two values can derive one. A
 * listed value has a shape of its own.
 */
export function sharedKeysOf(sections: MarkLegendSection[]): SharedKey[] {
  return sections.flatMap(({ markIndexes, scale }) => {
    if (scale.kind !== 'shape') {
      return []
    }
    const { entries, domain } = scale
    const listed = new Set(domain)
    const byShape = new Map<string, string[]>()
    for (const { value, shape } of entries) {
      if (value !== '') {
        byShape.set(shape, [...(byShape.get(shape) ?? []), value])
      }
    }
    const shared = [...byShape.values()].filter(
      values => values.length > 1 && values.some(v => !listed.has(v)),
    )
    return shared.length > 0
      ? [
          {
            markIndexes,
            channel: 'shape' as const,
            shared,
            pinned: [
              ...domain,
              ...entries.flatMap(({ value }) =>
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
export function sharedKeyNotice({ markIndexes, shared }: SharedKey) {
  return `mark ${markIndexes.join(', ')} shape: ${shared.map(quoted).join('; ')} share one shape, since a value the domain does not list takes a shape derived from itself; Pin distinct shapes lists them`
}
