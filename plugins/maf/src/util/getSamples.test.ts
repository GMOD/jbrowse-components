import { parseNewick } from '@jbrowse/tree-sidebar'

import {
  collectLeafNames,
  getSamplesFromConfig,
  normalizeSamples,
  resolveSamplesFromTree,
} from './getSamples.ts'

import type { NewickNode } from '@jbrowse/tree-sidebar'

describe('getSamplesFromConfig sample-set resolution', () => {
  const noTree = {
    uri: '/path/to/my.nh',
    locationType: 'UriLocation' as const,
  }

  test('no tree → samples config is the set, in listed order', async () => {
    const { samples } = await getSamplesFromConfig(noTree, ['b', 'a'])
    expect(samples.map(s => s.id)).toEqual(['b', 'a'])
  })

  test('no tree, no samples → empty (caller discovers from data)', async () => {
    const { samples } = await getSamplesFromConfig(noTree, [])
    expect(samples).toEqual([])
  })
})

describe('collectLeafNames', () => {
  test('depth-first leaf order from a Newick tree', () => {
    const tree = parseNewick(
      '((microvolvox:0.5,minivolvox:0.3):0.2,(simvolvox:0.2,volvox:0.1):0.4);',
    )
    expect(collectLeafNames(tree)).toEqual([
      'microvolvox',
      'minivolvox',
      'simvolvox',
      'volvox',
    ])
  })

  test('preserves haplotype-suffixed leaf names', () => {
    const tree = parseNewick('(Species1.1:0.1,Species1.2:0.2,Species2.1:0.3);')
    expect(collectLeafNames(tree)).toEqual([
      'Species1.1',
      'Species1.2',
      'Species2.1',
    ])
  })

  test('single leaf', () => {
    expect(collectLeafNames(parseNewick('(A);'))).toEqual(['A'])
  })
  // Left-to-right order is row order, and a guide tree promises no depth bound.
  // Recursion threw here past a few thousand tips, during sample resolution —
  // so it failed the whole track, not one drawing pass.
  test('a caterpillar deeper than the call stack keeps its leaf order', () => {
    let deep: NewickNode = { name: 'l0' }
    for (let i = 1; i < 20_000; i++) {
      deep = { name: `i${i}`, children: [deep, { name: `l${i}` }] }
    }
    const names = collectLeafNames(deep)
    expect(names).toHaveLength(20_000)
    expect(names.slice(0, 3)).toEqual(['l0', 'l1', 'l2'])
    expect(names.at(-1)).toBe('l19999')
  })
})

test('string array — id used as label fallback', () => {
  expect(normalizeSamples(['hg38', 'mm10'])).toEqual([
    { id: 'hg38', label: 'hg38' },
    { id: 'mm10', label: 'mm10' },
  ])
})

test('object array with explicit label and color preserved', () => {
  expect(
    normalizeSamples([
      { id: 'hg38', label: 'Human', color: 'red' },
      { id: 'mm10', label: 'Mouse' },
    ]),
  ).toEqual([
    { id: 'hg38', label: 'Human', color: 'red' },
    { id: 'mm10', label: 'Mouse', color: undefined },
  ])
})

test('object array — missing label defaults to id', () => {
  expect(normalizeSamples([{ id: 'hg38' }])).toEqual([
    { id: 'hg38', label: 'hg38', color: undefined },
  ])
})

test('empty array', () => {
  expect(normalizeSamples([])).toEqual([])
})

// Each entry is read on its own. The array used to be typed off element 0, so a
// list that started with a name read every object after it as a name — `String`
// of an object — and one that started with an object read the plain names as
// objects with an `undefined` id, which threw out of sample resolution and so
// failed the whole track.
test('an array may mix plain names and objects', () => {
  expect(
    normalizeSamples(['hg38', { id: 'mm10', label: 'Mouse', color: 'red' }]),
  ).toEqual([
    { id: 'hg38', label: 'hg38' },
    { id: 'mm10', label: 'Mouse', color: 'red' },
  ])
  expect(
    normalizeSamples([{ id: 'mm10', label: 'Mouse' }, 'hg38']),
  ).toMatchObject([
    { id: 'mm10', label: 'Mouse' },
    { id: 'hg38', label: 'hg38' },
  ])
})

test('an entry naming nothing is dropped, not made a nameless row', () => {
  expect(
    normalizeSamples(['', '  ', { label: 'Human' } as never, { id: 'mm10' }]),
  ).toEqual([{ id: 'mm10', label: 'mm10' }])
})

describe('resolveSamplesFromTree', () => {
  const tree = '((hg38:0.1,mm10:0.2):0.3,panTro6:0.4);'

  test('leaf order from tree, id used as label when no config override', () => {
    const samples = resolveSamplesFromTree(tree, [])
    expect(samples.map(s => s.id)).toEqual(['hg38', 'mm10', 'panTro6'])
    expect(samples[0]).toEqual({ id: 'hg38', label: 'hg38' })
  })

  test('config override applies label and color to matching leaf', () => {
    const overrides = [
      { id: 'hg38', label: 'Human', color: 'red' },
      { id: 'mm10', label: 'Mouse' },
    ]
    const samples = resolveSamplesFromTree(tree, overrides)
    expect(samples[0]).toEqual({ id: 'hg38', label: 'Human', color: 'red' })
    expect(samples[1]).toEqual({ id: 'mm10', label: 'Mouse', color: undefined })
    // leaf with no override falls back to id=label
    expect(samples[2]).toEqual({ id: 'panTro6', label: 'panTro6' })
  })

  test('tree order takes precedence over config order', () => {
    // config lists mm10 first, but tree has hg38 first
    const overrides = [
      { id: 'mm10', label: 'Mouse' },
      { id: 'hg38', label: 'Human' },
    ]
    const samples = resolveSamplesFromTree(tree, overrides)
    expect(samples.map(s => s.id)).toEqual(['hg38', 'mm10', 'panTro6'])
  })

  test('haplotype-suffixed leaf names preserved', () => {
    const haplotypes = '(Species1.1:0.1,Species1.2:0.2);'
    const samples = resolveSamplesFromTree(haplotypes, [])
    expect(samples.map(s => s.id)).toEqual(['Species1.1', 'Species1.2'])
  })
})

// Ids are matched against the file's source tokens character for character, so
// a stray space is a total mismatch that reads as a correct config. Trimmed at
// the source, so the id the sidebar labels with, the id `rowIndexBySrc` keys on
// and the id the adapter matches are one string.
describe('sample ids are trimmed where they are created', () => {
  test('the string-array config form', () => {
    expect(normalizeSamples([' hg38', 'panTro4 '])).toEqual([
      { id: 'hg38', label: 'hg38' },
      { id: 'panTro4', label: 'panTro4' },
    ])
  })

  test('the object config form, label left alone when given', () => {
    expect(normalizeSamples([{ id: ' hg38 ', label: 'Human ' }])).toEqual([
      { id: 'hg38', label: 'Human ' },
    ])
    expect(normalizeSamples([{ id: ' hg38 ' }])).toEqual([
      { id: 'hg38', label: 'hg38' },
    ])
  })

  test('Newick leaf names', () => {
    expect(collectLeafNames(parseNewick('(( hg38 , panTro4 ),mm10);'))).toEqual(
      ['hg38', 'panTro4', 'mm10'],
    )
  })
})
