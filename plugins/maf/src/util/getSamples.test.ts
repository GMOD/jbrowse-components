import { parseNewick } from '@jbrowse/tree-sidebar'

import {
  collectLeafNames,
  getSamplesFromConfig,
  normalizeSamples,
} from './getSamples.ts'

describe('getSamplesFromConfig sample-set resolution', () => {
  const noTree = { uri: '/path/to/my.nh' }

  test('no tree → samples config is the set, in listed order', async () => {
    const conf: Record<string, unknown> = {
      nhLocation: noTree,
      samples: ['b', 'a'],
    }
    const { samples } = await getSamplesFromConfig(k => conf[k])
    expect(samples.map(s => s.id)).toEqual(['b', 'a'])
  })

  test('no tree, no samples → empty (caller discovers from data)', async () => {
    const conf: Record<string, unknown> = { nhLocation: noTree, samples: [] }
    const { samples } = await getSamplesFromConfig(k => conf[k])
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
