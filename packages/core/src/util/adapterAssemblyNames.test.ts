import {
  adapterAssemblyNames,
  adapterNamespaceNames,
  adapterSpelling,
} from './adapterAssemblyNames.ts'

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

test('the track names stand in only for a config naming no assembly', () => {
  expect(
    adapterNamespaceNames({ assemblyNames: ['q', 't'] }, ['Q', 'T']),
  ).toEqual(['q', 't'])
  expect(adapterNamespaceNames({ type: 'GbzAdapter' }, ['Q', 'T'])).toEqual([
    'Q',
    'T',
  ])
  expect(adapterNamespaceNames({ type: 'GbzAdapter' })).toEqual([])
})

describe('the spelling an adapter config gives an assembly', () => {
  const assembly = {
    name: 'A',
    hasName: (name: string) => name === 'A' || name === 'X',
  }

  test('is the assembly name where the config lists it, ahead of an alias another assembly may hold', () => {
    expect(adapterSpelling(assembly, { assemblyNames: ['X', 'A'] })).toBe('A')
  })

  test('is the first alias the config lists otherwise', () => {
    expect(adapterSpelling(assembly, { assemblyNames: ['B', 'X'] })).toBe('X')
  })

  test('is the assembly name for a config naming it by nothing', () => {
    expect(adapterSpelling(assembly, { assemblyNames: ['B', 'C'] })).toBe('A')
    expect(adapterSpelling(assembly, { type: 'BamAdapter' })).toBe('A')
  })
})
