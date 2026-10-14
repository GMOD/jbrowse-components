import { placeSyntenyTracks } from './initHelpers.ts'

import type { SyntenyTrackInit } from '../types.ts'

const configured: Record<string, string[]> = {
  a_b: ['a', 'b'],
  c_b: ['c', 'b'],
  a_c: ['a', 'c'],
  all: ['a', 'b', 'c'],
  self_a: ['a', 'a'],
  nameless: [],
}

const assemblyManager = {
  getCanonicalAssemblyName: (name: string) => (name === 'A' ? 'a' : name),
}

function place(
  tracks: SyntenyTrackInit[] | SyntenyTrackInit[][],
  rows: string[],
) {
  return placeSyntenyTracks({
    tracks,
    rows,
    assemblyNamesOf: entry =>
      typeof entry === 'string'
        ? configured[entry]
        : ((entry.assemblyNames as string[] | undefined) ?? []),
    assemblyManager,
  })
}

test('a nested list names its bands as written', () => {
  expect(place([['a_c'], []], ['a', 'b', 'c'])).toEqual({
    levels: [['a_c'], []],
    problems: [],
  })
})

test('a multi-genome track backs every band it covers', () => {
  expect(place(['all'], ['a', 'b', 'c', 'b'])).toEqual({
    levels: [['all'], ['all'], ['all']],
    problems: [],
  })
})

test('a pairwise chain finds its own bands, in either name order', () => {
  expect(place(['c_b', 'a_b'], ['a', 'b', 'c']).levels).toEqual([
    ['a_b'],
    ['c_b'],
  ])
})

test('a pair recurring in the stack gets the track on each band', () => {
  expect(place(['a_b'], ['a', 'b', 'a']).levels).toEqual([['a_b'], ['a_b']])
})

test('rows match a track through assembly aliases', () => {
  expect(place(['a_b'], ['A', 'b']).levels).toEqual([['a_b']])
})

test('a self pair needs a track naming the assembly twice', () => {
  const { levels, problems } = place(['a_b', 'self_a'], ['a', 'a', 'b'])
  expect(levels).toEqual([['self_a'], ['a_b']])
  expect(problems).toEqual([])
})

test('a track covering no band is reported and not placed', () => {
  const { levels, problems } = place(['a_b', 'c_b', 'a_c'], ['a', 'b', 'c'])
  expect(levels).toEqual([['a_b'], ['c_b']])
  expect(problems).toEqual([
    {
      level: 'error',
      message: expect.stringContaining('"a_c" (a, c) covers no adjacent pair'),
    },
  ])
})

test('the rule holds on a two-row view', () => {
  const { levels, problems } = place(['a_b', 'a_c'], ['a', 'b'])
  expect(levels).toEqual([['a_b']])
  expect(problems.map(p => p.level)).toEqual(['error'])
})

test('a track with no assemblyNames is refused', () => {
  const { levels, problems } = place(['nameless'], ['a', 'b'])
  expect(levels).toEqual([[]])
  expect(problems).toEqual([
    {
      level: 'error',
      message: expect.stringContaining('"nameless" names no assemblyNames'),
    },
  ])
})

test('an inline entry is judged by its own assemblyNames', () => {
  const inline = { trackId: 'a_b', uri: 'x.paf', assemblyNames: ['b', 'c'] }
  expect(place([inline], ['a', 'b', 'c']).levels).toEqual([[], [inline]])
})

test('a loose inline entry without assemblyNames is refused', () => {
  const { levels, problems } = place(
    [{ trackId: 'loose', uri: 'x.paf' }],
    ['a', 'b', 'c'],
  )
  expect(levels).toEqual([[], []])
  expect(problems[0]!.message).toContain('"loose" names no assemblyNames')
})

test('an unknown trackId goes on band 0, where the launch reports it', () => {
  expect(place(['missing', 'all'], ['a', 'b', 'c'])).toEqual({
    levels: [['missing', 'all'], ['all']],
    problems: [],
  })
})

test('a band no flat entry covers is warned about', () => {
  expect(place(['a_b'], ['a', 'b', 'c']).problems).toEqual([
    {
      level: 'warning',
      message: 'No synteny track in `tracks` covers the band between b and c',
    },
  ])
})

test('a mixed list is refused whole', () => {
  const { levels, problems } = place(
    ['all', ['a_b']] as unknown as SyntenyTrackInit[],
    ['a', 'b', 'c'],
  )
  expect(levels).toEqual([[], []])
  expect(problems[0]!.message).toContain('mixes per-band lists')
})

test('an empty list places nothing and says nothing', () => {
  expect(place([], ['a', 'b', 'c'])).toEqual({ levels: [], problems: [] })
})
