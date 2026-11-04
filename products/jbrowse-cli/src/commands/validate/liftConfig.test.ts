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

// The rows every consumer shares are products/jbrowse-web's
// KeyedWritesParity.test.ts table, over one display's slots; these are the
// merged slots of a quantitative track's displays, and the CLI's raw output
describe('mergeBySlots over a keyed rows object', () => {
  const slots = displayDefaultSlots('QuantitativeTrack')
  const arranged = {
    rows: {
      field: 'source',
      sort: ['b', 'a'],
      labels: { a: 'A' },
      colors: { a: '#f00' },
    },
  }

  test('the merged slot keeps the keyed declaration', () => {
    expect(slots.find(s => s.name === 'rows')?.writes).toEqual({
      keyedBy: 'field',
      keyed: ['sort', 'labels', 'colors', 'tree', 'kept'],
    })
  })

  test('null resets one member, left for the app to read', () => {
    expect(
      mergeBySlots(arranged, { rows: { labels: null } }, slots).rows,
    ).toEqual({ ...arranged.rows, labels: null })
  })
})

// A VariantTrack's bag reaches its mark display too, whose rows read
// `sample` and `haplotype` as columns, so the merged slot keeps no refinement
// and a switch there drops the arrangement
describe('mergeBySlots over a VariantTrack rows object', () => {
  const slots = displayDefaultSlots('VariantTrack')
  const hosted = { sort: ['NA12878', 'NA12891'], labels: { NA12878: 'Child' } }

  test('the merged slot keeps no refinement its mark display lacks', () => {
    const writes = slots.find(s => s.name === 'rows')?.writes
    expect(writes).toMatchObject({ keyedBy: 'field' })
    expect(writes).not.toHaveProperty('refines')
  })

  test('a switch to haplotype drops the arrangement', () => {
    expect(
      mergeBySlots(
        { rows: { field: 'sample', ...hosted } },
        { rows: 'haplotype' },
        slots,
      ).rows,
    ).toEqual({ field: 'haplotype' })
  })
})

describe('displayDefaultSlots folds writes across displays', () => {
  const field = { name: 'field', type: 'string' }
  const rowsOn = (
    writes: SlotEntry['writes'],
    members: string[],
  ): SlotEntry => ({
    name: 'rows',
    type: 'Rows',
    subSlots: [field, ...members.map(name => ({ name, type: 'stringArray' }))],
    writes,
    shorthand: { string: 'field' },
  })
  const foldOf = (...rows: SlotEntry[]) => {
    const displays = Object.fromEntries(
      rows.map((slot, i) => [`D${i}`, { slots: [slot] }]),
    )
    const manifest = {
      ...configManifest,
      tracks: { T: { slots: [], displayTypes: Object.keys(displays) } },
      displays,
    }
    return displayDefaultSlots('T', manifest).find(s => s.name === 'rows')
  }
  const keyedOn = (keyed: string[], keyedBy = 'field') =>
    rowsOn({ keyedBy, keyed }, keyed)

  test('keyed lists union, a member some displays lack included', () => {
    const rows = foldOf(
      keyedOn(['sort', 'labels']),
      rowsOn({ keyedBy: 'field', keyed: ['sort', 'groups'] }, [
        'sort',
        'groups',
        'step',
      ]),
    )
    expect(rows?.writes).toEqual({
      keyedBy: 'field',
      keyed: ['sort', 'labels', 'groups'],
    })
    expect(
      mergeBySlots(
        {
          rows: { field: 'a', sort: ['x'], labels: {}, groups: [], step: 8 },
        },
        { rows: 'b' },
        rows ? [rows] : [],
      ),
    ).toEqual({ rows: { field: 'b', step: 8 } })
  })

  test('keyed beside members is keyed', () => {
    expect(
      foldOf(keyedOn(['sort']), rowsOn('members', ['sort']))?.writes,
    ).toEqual({ keyedBy: 'field', keyed: ['sort'] })
  })

  test('any whole declaration is whole', () => {
    expect(foldOf(keyedOn(['sort']), rowsOn('whole', ['sort']))?.writes).toBe(
      'whole',
    )
  })

  test('keyed by different fields is whole', () => {
    expect(foldOf(keyedOn(['sort']), keyedOn(['sort'], 'sort'))?.writes).toBe(
      'whole',
    )
  })

  const refining = (refines: Record<string, string>) =>
    rowsOn({ keyedBy: 'field', keyed: ['sort'], refines }, ['sort'])

  // the refinement rows of KeyedWritesParity.test.ts, over merged slots
  test.each([
    ['sample', 'haplotype'],
    ['haplotype', 'sample'],
  ])(
    'a refinement every display states keeps the arrangement from %s to %s',
    (from, to) => {
      const rows = foldOf(
        refining({ haplotype: 'sample' }),
        refining({ haplotype: 'sample' }),
      )
      expect(rows?.writes).toEqual({
        keyedBy: 'field',
        keyed: ['sort'],
        refines: { haplotype: 'sample' },
      })
      const merge = (write: string) =>
        mergeBySlots(
          { rows: { field: from, sort: ['x'] } },
          { rows: write },
          rows ? [rows] : [],
        ).rows
      expect(merge(to)).toEqual({ field: to, sort: ['x'] })
      expect(merge('tissue')).toEqual({ field: 'tissue' })
    },
  )

  test('a refinement one keyed display lacks is dropped', () => {
    expect(
      foldOf(refining({ haplotype: 'sample' }), keyedOn(['sort']))?.writes,
    ).toEqual({ keyedBy: 'field', keyed: ['sort'] })
  })

  test('a value two displays refine differently refines nothing', () => {
    expect(
      foldOf(
        refining({ haplotype: 'sample' }),
        refining({ haplotype: 'source' }),
      )?.writes,
    ).toEqual({ keyedBy: 'field', keyed: ['sort'] })
  })

  test('members everywhere stays members', () => {
    expect(
      foldOf(rowsOn('members', ['sort']), rowsOn('members', ['sort']))?.writes,
    ).toBe('members')
  })
})
