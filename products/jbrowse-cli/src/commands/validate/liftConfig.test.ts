import { configManifest } from './configManifest.generated.ts'
import { displayDefaultSlots } from './displayDefaultKeys.ts'
import { liftToSnapshot, mergeBySlots } from './liftConfig.ts'

import type { SlotEntry } from './types.ts'

const filter: SlotEntry = {
  name: 'filter',
  type: 'Predicates',
  subSlots: [
    { name: 'expressions', type: 'array' },
    { name: 'minScore', type: 'number' },
  ],
  shorthand: { list: 'expressions' },
}

const rules: SlotEntry = {
  name: 'rules',
  type: 'array',
  subSlots: [{ name: 'value', type: 'number' }],
  shorthand: { number: 'value' },
}

test('a list lifts into the slot its shorthand names', () => {
  expect(
    liftToSnapshot({ filter: ['jexl:feature.score > 1'] }, [filter]),
  ).toEqual({ filter: { expressions: ['jexl:feature.score > 1'] } })
})

test('a list of sub-schemas still lifts entry by entry', () => {
  expect(liftToSnapshot({ rules: [5, { value: 7 }] }, [rules])).toEqual({
    rules: [{ value: 5 }, { value: 7 }],
  })
})

describe('mergeBySlots, over the slots a track type writes', () => {
  const wiggle = displayDefaultSlots('QuantitativeTrack')
  const feature = displayDefaultSlots('FeatureTrack')

  test('a bare name merges into the members the other bag writes', () => {
    expect(
      mergeBySlots(
        { mark: { type: 'bar', extent: 'none' } },
        { mark: 'line' },
        wiggle,
      ),
    ).toEqual({ mark: { type: 'line', extent: 'none' } })
  })

  test('a channel takes the later bag whole', () => {
    expect(
      mergeBySlots(
        { encoding: { color: { value: 'red' } }, height: 50 },
        { encoding: { color: { field: 'strand' } } },
        feature,
      ),
    ).toEqual({ encoding: { color: { field: 'strand' } }, height: 50 })
  })

  test('a value merged with nothing keeps its spelling', () => {
    expect(mergeBySlots({ height: 50 }, { mark: 'line' }, wiggle)).toEqual({
      height: 50,
      mark: 'line',
    })
  })

  test("a plugin track's keys merge as plain JSON", () => {
    expect(
      mergeBySlots({ thing: { a: 1, b: 2 } }, { thing: { b: 3 } }),
    ).toEqual({ thing: { a: 1, b: 3 } })
  })
})

// Every member-written sub-schema with a string shorthand on every display
// the manifest carries, so a new one is held to the merge the day the
// manifest regenerates with it.
function memberShorthands(slots: SlotEntry[], path: string[] = []) {
  return slots.flatMap(
    (slot): { path: string[]; target: string; other: string }[] => {
      if (!slot.subSlots || slot.writes !== 'members') {
        return []
      }
      const here = [...path, slot.name]
      const target = slot.shorthand?.string
      const other = slot.subSlots.find(s => s.name !== target)?.name
      return [
        ...(target && other ? [{ path: here, target, other }] : []),
        ...memberShorthands(slot.subSlots, here),
      ]
    },
  )
}

const nested = (path: string[], value: unknown) =>
  path.reduceRight<unknown>(
    (inner, key) => ({ [key]: inner }),
    value,
  ) as Record<string, unknown>

const at = (bag: unknown, path: string[]) =>
  path.reduce<unknown>(
    (node, key) => (node as Record<string, unknown>)[key],
    bag,
  )

const cases = Object.entries(configManifest.displays).flatMap(([name, entry]) =>
  memberShorthands(entry.slots).map(c => ({ ...c, name, slots: entry.slots })),
)

test('the manifest walk finds the member-written shorthands', () => {
  expect(cases.map(c => c.path.join('.'))).toEqual(
    expect.arrayContaining(['mark', 'labels.name']),
  )
})

test.each(cases.map(c => [`${c.name} ${c.path.join('.')}`, c] as const))(
  '%s: a bare value over the object form keeps its other members',
  (_label, { path, target, other, slots }) => {
    const merged = mergeBySlots(
      nested(path, { [target]: 'old', [other]: 'kept' }),
      nested(path, 'bare'),
      slots,
    )
    expect(at(merged, path)).toMatchObject({
      [target]: 'bare',
      [other]: 'kept',
    })
  },
)
