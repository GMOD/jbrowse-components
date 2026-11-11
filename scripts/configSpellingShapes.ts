import { slotPathsByType } from './configSlotPaths.ts'

import type { JsonSchema } from './configJsonSchema.ts'

export const byName = (a: string, b: string) => a.localeCompare(b, 'en')

export const displayTypes = (byType: Map<string, Set<string>>) =>
  [...byType.keys()].filter(type => type.endsWith('Display')).sort(byName)

export const short = (type: string) => type.replace(/Display$/, '')

export const code = (words: Iterable<string>) =>
  [...words].map(word => `\`${word}\``).join(' ')

// A field's values and the display type's aliases are each display's own by
// design.
const isDataWord = (slot: string) => slot === 'type' || slot.endsWith('field')

const PART_WORDS = new Set(['facet', 'tooltip', 'labels', 'mark', 'placement'])

// A channel under a part's `encoding`, and a part's own facet, tooltip,
// labels, mark or placement, use the display's vocabulary (ADR-238). Such a
// slot compares as its path from the last `encoding` segment with a channel
// below it, else from the last segment that is exactly one of those words,
// the segments before it naming the part beside the display.
function partSlot(slot: string) {
  const segments = slot.split('.')
  const channel = segments.lastIndexOf('encoding')
  const at =
    channel !== -1 && channel < segments.length - 1
      ? channel
      : segments.findLastIndex(segment => PART_WORDS.has(segment))
  return at > 0
    ? {
        slot: segments.slice(at).join('.'),
        part: segments.slice(0, at).join('.'),
      }
    : { slot, part: '' }
}

// A path's shape: the members below it, or for a leaf the values its enum
// admits. An object's shorthand values are left out, as the members say it.
function shapes(lines: Iterable<string>) {
  const members = new Map<string, Set<string>>()
  const values = new Map<string, Set<string>>()
  const add = (
    byPath: Map<string, Set<string>>,
    slot: string,
    word?: string,
  ) => {
    const set = byPath.get(slot) ?? new Set<string>()
    if (word !== undefined) {
      set.add(word)
    }
    byPath.set(slot, set)
  }
  for (const line of lines) {
    const eq = line.indexOf('=')
    const slot = eq === -1 ? line : line.slice(0, eq)
    add(members, slot)
    if (eq !== -1) {
      add(values, slot, `=${line.slice(eq + 1)}`)
    }
    const dot = slot.lastIndexOf('.')
    if (dot !== -1) {
      add(members, slot.slice(0, dot), slot.slice(dot + 1))
    }
  }
  return new Map(
    [...members]
      .filter(([slot]) => !isDataWord(slot))
      .map(([slot, words]) => [
        slot,
        words.size > 0 ? words : (values.get(slot) ?? words),
      ]),
  )
}

/**
 * Each path whose shape differs between displays, or between one display's
 * parts, with its variants: the members or values, and who holds them.
 */
export function divergentShapes(schema: JsonSchema) {
  const live = slotPathsByType(schema, { live: true })
  const variants = new Map<string, Map<string, string[]>>()
  for (const type of displayTypes(live)) {
    for (const [fullPath, words] of shapes(live.get(type)!)) {
      const { slot, part } = partSlot(fullPath)
      const key = [...words].sort(byName).join(' ')
      const bySlot = variants.get(slot) ?? new Map<string, string[]>()
      bySlot.set(key, [
        ...(bySlot.get(key) ?? []),
        part ? `${short(type)} \`${part}\`` : short(type),
      ])
      variants.set(slot, bySlot)
    }
  }
  return new Map(
    [...variants]
      .filter(([, bySlot]) => bySlot.size > 1)
      .sort(([a], [b]) => byName(a, b)),
  )
}

export interface Ruling {
  variants: number
  why: string
  open?: string
}

const variantLines = (bySlot: Map<string, string[]>) =>
  [...bySlot].map(
    ([members, holders]) =>
      `    [${members || 'leaf'}] <- ${holders.join(', ')}`,
  )

/**
 * Where the rulings and the differing paths disagree: a path with no entry,
 * one whose variant count moved, and an entry whose path no longer differs.
 */
export function rulingProblems(
  schema: JsonSchema,
  rulings: Record<string, Ruling>,
) {
  const divergent = divergentShapes(schema)
  return [
    ...[...divergent].flatMap(([slot, bySlot]) => {
      const ruling = rulings[slot]
      return ruling?.variants === bySlot.size
        ? []
        : [
            [
              ruling
                ? `${slot} has ${bySlot.size} shapes and its ruling says ${ruling.variants}; re-read its why against:`
                : `${slot} differs with no ruling; add '${slot}': { variants: ${bySlot.size}, why: '...' } for:`,
              ...variantLines(bySlot),
            ].join('\n'),
          ]
    }),
    ...Object.keys(rulings)
      .filter(slot => !divergent.has(slot))
      .map(slot => `${slot} no longer differs; delete its ruling`),
  ]
}
