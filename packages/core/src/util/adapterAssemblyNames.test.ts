import { adapterAssemblyNames } from './adapterAssemblyNames.ts'

test('a config naming assemblyNames answers them', () => {
  expect(adapterAssemblyNames({ assemblyNames: ['q', 't'] })).toEqual([
    'q',
    't',
  ])
})

test('a pairwise config with no assemblyNames answers its named pair', () => {
  expect(
    adapterAssemblyNames({
      assemblyNames: [],
      queryAssembly: 'q',
      targetAssembly: 't',
    }),
  ).toEqual(['q', 't'])
})

// A blocks table's columns are its genomes, and a genome holding several
// columns is still one assembly to respell into.
test('an MCScan blocks config naming only its columns answers each column genome once', () => {
  expect(
    adapterAssemblyNames({
      type: 'MCScanBlocksAdapter',
      blockAssemblies: ['grape', 'peach', 'peach', 'cacao'],
    }),
  ).toEqual(['grape', 'peach', 'cacao'])
})

test('an MCScan blocks config narrowing its columns answers the narrowed list', () => {
  expect(
    adapterAssemblyNames({
      type: 'MCScanBlocksAdapter',
      blockAssemblies: ['grape', 'peach', 'cacao'],
      assemblyNames: ['grape', 'peach'],
    }),
  ).toEqual(['grape', 'peach'])
})

test('a star answers what its children name, the anchor they share first', () => {
  expect(
    adapterAssemblyNames({
      type: 'MultiPairwiseSyntenyAdapter',
      adapters: [
        { type: 'PAFAdapter', assemblyNames: ['panTro6', 'hg38'] },
        { type: 'ChainAdapter', queryAssembly: 'hg38', targetAssembly: 'mm39' },
        { type: 'PAFAdapter', assemblyNames: ['gorGor6', 'hg38'] },
      ],
    }),
  ).toEqual(['hg38', 'panTro6', 'mm39', 'gorGor6'])
})

test('a config naming no assembly answers none', () => {
  expect(adapterAssemblyNames({ type: 'MCScanBlocksAdapter' })).toEqual([])
  expect(adapterAssemblyNames({ type: 'BamAdapter' })).toEqual([])
})
