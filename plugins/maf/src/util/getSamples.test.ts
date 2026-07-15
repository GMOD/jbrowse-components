import { parseNewick } from '@jbrowse/tree-sidebar'

import {
  collectLeafNames,
  getSamplesFromConfig,
  normalizeSamples,
  resolveSamplesFromTree,
} from './getSamples.ts'

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
