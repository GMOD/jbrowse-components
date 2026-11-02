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

// core's keyedWrites.test.ts table, on the rows a quantitative track's
// displays declare
describe('mergeBySlots over a keyed rows object', () => {
  const slots = displayDefaultSlots('QuantitativeTrack')
  const CLUSTERED = {
    newick: '(a,b);',
    provenance: { regions: [{ refName: 'chr1', start: 0, end: 100 }] },
  }
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
      keyed: ['sort', 'labels', 'tree', 'kept', 'colors'],
    })
  })

  test.each([
    {
      name: 'a new field unsets the keyed members',
      base: arranged,
      write: { rows: 'tissue' },
      rows: { field: 'tissue' },
    },
    {
      name: 'a new field keeps the keyed members it states',
      base: arranged,
      write: { rows: { field: 'tissue', sort: ['x'] } },
      rows: { field: 'tissue', sort: ['x'] },
    },
    {
      name: 'a new field keeps the pins it states, and only those',
      base: arranged,
      write: { rows: { field: 'tissue', colors: { liver: '#0f0' } } },
      rows: { field: 'tissue', colors: { liver: '#0f0' } },
    },
    {
      name: 'a new field stated after a keyed member still keeps that member',
      base: arranged,
      write: { rows: { sort: ['x'], field: 'tissue' } },
      rows: { field: 'tissue', sort: ['x'] },
    },
    {
      name: 'restating the field in force keeps the arrangement',
      base: arranged,
      write: { rows: 'source' },
      rows: arranged.rows,
    },
    {
      name: 'a write over an empty field resets nothing',
      base: { rows: { sort: ['b', 'a'] } },
      write: { rows: 'sample' },
      rows: { field: 'sample', sort: ['b', 'a'] },
    },
    {
      name: 'a write over a bare field unsets nothing it did not hold',
      base: { rows: 'source' },
      write: { rows: 'tissue' },
      rows: { field: 'tissue' },
    },
    {
      name: 'a member write without the field merges',
      base: arranged,
      write: { rows: { sort: ['a', 'b'] } },
      rows: { ...arranged.rows, sort: ['a', 'b'] },
    },
    {
      name: 'null resets one member, left for the app to read',
      base: arranged,
      write: { rows: { labels: null } },
      rows: { ...arranged.rows, labels: null },
    },
    {
      name: 'a new field drops the tree with its provenance',
      base: { rows: { field: 'source', tree: CLUSTERED } },
      write: { rows: 'tissue' },
      rows: { field: 'tissue' },
    },
    {
      name: 'a tree written as newick drops the clustered provenance',
      base: { rows: { field: 'source', tree: CLUSTERED } },
      write: { rows: { tree: '(b,a);' } },
      rows: { field: 'source', tree: { newick: '(b,a);' } },
    },
    {
      name: 'emptying the newick drops the clustered provenance',
      base: { rows: { field: 'source', tree: CLUSTERED } },
      write: { rows: { tree: { newick: '' } } },
      rows: { field: 'source', tree: { newick: '' } },
    },
    {
      name: 'a newick member write drops the clustered provenance',
      base: { rows: { field: 'source', tree: CLUSTERED } },
      write: { rows: { tree: { newick: '(b,a);' } } },
      rows: { field: 'source', tree: { newick: '(b,a);' } },
    },
  ])('$name', ({ base, write, rows }) => {
    expect(mergeBySlots(base, write, slots).rows).toEqual(rows)
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

  test('refinements union across the displays declaring them', () => {
    expect(
      foldOf(
        rowsOn(
          {
            keyedBy: 'field',
            keyed: ['sort'],
            refines: { haplotype: 'sample' },
          },
          ['sort'],
        ),
        keyedOn(['sort']),
      )?.writes,
    ).toEqual({
      keyedBy: 'field',
      keyed: ['sort'],
      refines: { haplotype: 'sample' },
    })
  })

  test('one value refining two is whole', () => {
    expect(
      foldOf(
        rowsOn(
          {
            keyedBy: 'field',
            keyed: ['sort'],
            refines: { haplotype: 'sample' },
          },
          ['sort'],
        ),
        rowsOn(
          {
            keyedBy: 'field',
            keyed: ['sort'],
            refines: { haplotype: 'source' },
          },
          ['sort'],
        ),
      )?.writes,
    ).toBe('whole')
  })

  test('members everywhere stays members', () => {
    expect(
      foldOf(rowsOn('members', ['sort']), rowsOn('members', ['sort']))?.writes,
    ).toBe('members')
  })
})
