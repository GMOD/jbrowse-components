import {
  ALIGNMENTS_FILTER_DEFAULTS,
  compileMapqFilter,
  compileRecordFilter,
  connectionEntries,
  connectionFilterOf,
  filterProblems,
  flagEntries,
  flagMasksOf,
  junctionEntries,
  junctionFilterOf,
  mergeFilter,
  predicatesOfFilterObject,
  readNameOf,
  tagEntries,
  tagFiltersOf,
  withField,
  withFields,
} from './alignmentsFilter.ts'

import type { FilterableRead } from './alignmentsFilter.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const merged = (written: FieldPredicate[]) => mergeFilter(written)

// The defaults left the config schema for this list, so ConfigSlotDefaults no
// longer pins them: a changed default shows here instead
test('the defaults, spelled out', () => {
  expect(ALIGNMENTS_FILTER_DEFAULTS).toEqual([
    { field: 'flags.UNMAP', equal: false },
    { field: 'flags.QCFAIL', equal: false },
    { field: 'flags.DUP', equal: false },
    { field: 'junction.reads', gte: 2 },
    { field: 'breakpoint.reads', gte: 2 },
  ])
})

describe('the merge by field', () => {
  test('nothing written is the defaults', () => {
    expect(merged([])).toEqual(ALIGNMENTS_FILTER_DEFAULTS)
  })

  test('an entry on another field keeps every default', () => {
    expect(merged([{ field: 'mapq', gte: 20 }])).toEqual([
      ...ALIGNMENTS_FILTER_DEFAULTS,
      { field: 'mapq', gte: 20 },
    ])
  })

  test("an entry replaces its own field's default", () => {
    const list = merged([{ field: 'flags.DUP', equal: true }])
    expect(list.filter(p => p.field === 'flags.DUP')).toEqual([
      { field: 'flags.DUP', equal: true },
    ])
    expect(flagMasksOf(list)).toEqual({ include: 1024, exclude: 4 | 512 })
  })

  test('a bare field removes its defaults and tests nothing', () => {
    const list = merged([{ field: 'flags.DUP' }])
    expect(list.some(p => p.field === 'flags.DUP')).toBe(false)
    expect(flagMasksOf(list).exclude).toBe(4 | 512)
  })

  test('every entry written on one field applies', () => {
    const written = [
      { field: 'mapq', gte: 20 },
      { field: 'mapq', lte: 50 },
    ]
    expect(merged(written).filter(p => p.field === 'mapq')).toEqual(written)
  })
})

describe('a write by field', () => {
  test('replaces the field in place and leaves the rest', () => {
    const written = [
      { field: 'mapq', gte: 20 },
      { field: 'name', equal: 'r1' },
    ]
    expect(withField(written, 'mapq', [{ field: 'mapq', gte: 30 }])).toEqual([
      { field: 'mapq', gte: 30 },
      { field: 'name', equal: 'r1' },
    ])
  })

  test('undefined returns a field to its defaults', () => {
    expect(
      withField([{ field: 'flags.DUP', equal: true }], 'flags.DUP', undefined),
    ).toEqual([])
  })

  test('an empty list over a defaulted field writes the bare field', () => {
    expect(withField([], 'flags.DUP', [])).toEqual([{ field: 'flags.DUP' }])
    expect(withField([{ field: 'mapq', gte: 2 }], 'mapq', [])).toEqual([])
  })

  test('the defaults written back are left unwritten', () => {
    expect(
      withField([{ field: 'junction.reads', gte: 5 }], 'junction.reads', [
        { field: 'junction.reads', gte: 2 },
      ]),
    ).toEqual([])
  })
})

describe('the junction and connection tests', () => {
  test('the defaults floor both counts at two', () => {
    expect(junctionFilterOf(merged([]))).toEqual({
      minReads: 2,
      nonCanonical: undefined,
    })
    expect(connectionFilterOf(merged([]))).toEqual({
      interchrom: undefined,
      offscreenMates: undefined,
      minInterchromReads: 2,
    })
  })

  test('a removed floor draws every row, and gt is one more than its bound', () => {
    expect(
      junctionFilterOf(merged([{ field: 'junction.reads' }])).minReads,
    ).toBe(1)
    expect(
      connectionFilterOf(merged([{ field: 'breakpoint.reads', gt: 4 }]))
        .minInterchromReads,
    ).toBe(5)
  })

  test.each([
    [{ minReads: 5 }],
    [{ minReads: 1 }],
    [{ nonCanonical: 'only' as const }],
    [{ nonCanonical: 'exclude' as const }],
  ])('a junction write reads back: %j', patch => {
    const list = merged(withFields([], junctionEntries(patch)))
    expect(junctionFilterOf(list)).toMatchObject(patch)
  })

  test.each([
    [{ interchrom: 'exclude' as const }],
    [{ offscreenMates: 'only' as const }],
    [{ minInterchromReads: 1 }],
    [{ minInterchromReads: 6 }],
  ])('a connection write reads back: %j', patch => {
    const list = merged(withFields([], connectionEntries(patch)))
    expect(connectionFilterOf(list)).toMatchObject(patch)
  })
})

describe('the read fields the dialog edits', () => {
  test('flag masks write and read back, the defaults unwritten', () => {
    expect(withFields([], flagEntries(0, 1540))).toEqual([])
    const written = withFields([], flagEntries(2, 1540 | 256))
    expect(written).toEqual([
      { field: 'flags.PROPER_PAIR', equal: true },
      { field: 'flags.SECONDARY', equal: false },
    ])
    expect(flagMasksOf(merged(written))).toEqual({
      include: 2,
      exclude: 1540 | 256,
    })
  })

  test('tags replace the tag fields written before', () => {
    const before = [
      { field: 'tags.HP', equal: '1' },
      { field: 'mapq', gte: 20 },
    ]
    const after = withFields(before, tagEntries(before, [{ tag: 'RG' }]))
    expect(after).toEqual([
      { field: 'mapq', gte: 20 },
      { field: 'tags.RG', valid: true },
    ])
    expect(tagFiltersOf(after)).toEqual([{ tag: 'RG' }])
  })

  test('the read name', () => {
    expect(readNameOf([{ field: 'name', equal: 'r1' }])).toBe('r1')
    expect(readNameOf([])).toBeUndefined()
  })
})

describe('the record test', () => {
  const read = (
    flags: number,
    tags: Record<string, unknown> = {},
    skip = false,
    name = 'r1',
  ): FilterableRead => ({
    flags,
    name,
    getTag: tag => tags[tag],
    cigarCategoryBits: skip ? 2 : 0,
  })
  const reads = [
    read(0),
    read(4),
    read(1024),
    read(2 | 16),
    read(256),
    read(0, { HP: 1 }),
    read(0, { HP: '2' }),
    read(0, { RG: 'a' }),
    read(0, {}, true),
    read(0, {}, false, 'r2'),
  ]
  const T = true
  const F = false

  test.each([
    [{}, [T, F, F, T, T, T, T, T, T, T]],
    [
      { flagInclude: 2, flagExclude: 1540 | 256 },
      [F, F, F, T, F, F, F, F, F, F],
    ],
    [{ flagInclude: 0, flagExclude: 0 }, [T, T, T, T, T, T, T, T, T, T]],
    [{ tags: [{ tag: 'HP', value: '1' }] }, [F, F, F, F, F, T, F, F, F, F]],
    [{ tags: [{ tag: 'HP' }] }, [F, F, F, F, F, T, T, F, F, F]],
    [{ readName: 'r2' }, [F, F, F, F, F, F, F, F, F, T]],
    [{ spliced: 'only' as const }, [F, F, F, F, F, F, F, F, T, F]],
    [{ spliced: 'exclude' as const }, [T, F, F, T, T, T, T, T, F, T]],
  ])('%j', (object, kept) => {
    const keeps = compileRecordFilter(
      mergeFilter(predicatesOfFilterObject(object)),
    )
    expect(reads.map(r => keeps?.(r) ?? true)).toEqual(kept)
  })

  test('a tag value is the read’s, and no value passes any read carrying the tag', () => {
    const keeps = compileRecordFilter([
      { field: 'tags.HP', equal: '1' },
      { field: 'tags.RG', valid: true },
    ])!
    expect(keeps(read(0, { HP: 1, RG: 'lib1' }))).toBe(true)
    expect(keeps(read(0, { HP: 2, RG: 'lib1' }))).toBe(false)
    expect(keeps(read(0, { HP: 1 }))).toBe(false)
  })

  test('a tag row naming no tag tests nothing', () => {
    expect(predicatesOfFilterObject({ tags: [{ tag: '' }] })).toEqual([])
  })
})

test('MAPQ 255, none reported, passes a floor', () => {
  const keeps = compileMapqFilter<number>([{ field: 'mapq', gte: 20 }], q => q)!
  expect([0, 19, 20, 60, 255].map(keeps)).toEqual([
    false,
    false,
    true,
    true,
    true,
  ])
})

describe('problems', () => {
  test('an unknown field and a misused row field', () => {
    expect(
      filterProblems([
        { field: 'mapq', gte: 20 },
        { field: 'tags.HP', equal: '1' },
        { field: 'flags.DUP', equal: true },
        { field: 'flags.NOPE', equal: true },
        { field: 'junction.reads', lte: 4 },
        { field: 'connection.interchrom', equal: 'yes' },
        { field: 'breakpoint.reads' },
      ]).map(p => p.split(',')[0]),
    ).toEqual([
      'filter: no field "flags.NOPE" on an alignment',
      'filter: junction.reads takes a floor (gte or gt)',
      'filter: connection.interchrom takes equal: true or false',
    ])
  })
})

test('the object form lifts member by member', () => {
  expect(
    predicatesOfFilterObject({
      minMapq: 20,
      svSignal: 'only',
      junctions: { minReads: 5, nonCanonical: 'exclude' },
      connections: { interchrom: 'exclude', minInterchromReads: 1 },
    }),
  ).toEqual([
    { field: 'mapq', gte: 20 },
    { field: 'svSignal', equal: true },
    { field: 'junction.reads', gte: 5 },
    { field: 'junction.canonical', equal: true },
    { field: 'connection.interchrom', equal: false },
    { field: 'breakpoint.reads' },
  ])
})
