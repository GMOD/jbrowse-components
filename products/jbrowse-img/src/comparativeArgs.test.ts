import { buildComparative, hasComparativeArgs } from './comparativeArgs.ts'

import type { Entry } from './parseArgv.ts'

describe('hasComparativeArgs', () => {
  test('a lone fasta is not comparative', () => {
    expect(hasComparativeArgs([['fasta', ['a.fa']]])).toBe(false)
  })
  test('a repeated fasta is comparative', () => {
    expect(
      hasComparativeArgs([
        ['fasta', ['a.fa']],
        ['fasta', ['b.fa']],
      ]),
    ).toBe(true)
  })
  test('any chromSizes or synteny file is comparative', () => {
    expect(hasComparativeArgs([['chromSizes', ['a.sizes']]])).toBe(true)
    expect(
      hasComparativeArgs([
        ['fasta', ['a.fa']],
        ['paf', ['a_b.paf']],
      ]),
    ).toBe(true)
  })
})

describe('buildComparative', () => {
  test('synteny level is inferred from argv order', () => {
    const entries: Entry[] = [
      ['chromSizes', ['a.sizes']],
      ['paf', ['a_b.paf']],
      ['chromSizes', ['b.sizes']],
      ['chain', ['b_c.chain']],
      ['chromSizes', ['c.sizes']],
    ]
    const { assemblies, syntenyTracks } = buildComparative(entries)
    // the `.sizes` extension is stripped from the assembly name (file-format
    // noise), so the scalebar label reads `a` not `a.sizes`
    expect(assemblies.map(a => a.name)).toEqual(['a', 'b', 'c'])
    expect(assemblies[0]!.sequence.adapter).toMatchObject({
      type: 'ChromSizesAdapter',
      chromSizesLocation: { localPath: 'a.sizes' },
    })
    // level 0 pairs a/b (paf: upper a = query), level 1 pairs b/c (chain: upper
    // b = target)
    expect(syntenyTracks[0]!.adapter).toMatchObject({
      queryAssembly: 'a',
      targetAssembly: 'b',
    })
    expect(syntenyTracks[1]!.adapter).toMatchObject({
      queryAssembly: 'c',
      targetAssembly: 'b',
    })
  })

  test('per-assembly options ride on the flag as key:value modifiers', () => {
    const { assemblies, locs } = buildComparative([
      ['fasta', ['a.fa', 'loc:chr1', 'aliases:a.txt']],
      ['paf', ['a_b.paf']],
      ['fasta', ['b.fa', 'loc:chr2']],
    ])
    expect(locs).toEqual(['chr1', 'chr2'])
    expect(assemblies[0]!.refNameAliases?.adapter).toMatchObject({
      location: { localPath: 'a.txt' },
    })
  })

  test('legacy --fasta2/--loc/--loc2 still map to assemblies 0 and 1', () => {
    const { assemblies, locs, syntenyTracks } = buildComparative([
      ['fasta', ['a.fa']],
      ['fasta2', ['b.fa']],
      ['loc', ['chr1']],
      ['loc2', ['chr2']],
      ['paf', ['a_b.paf']],
    ])
    expect(assemblies.map(a => a.name)).toEqual(['a.fa', 'b.fa'])
    expect(locs).toEqual(['chr1', 'chr2'])
    // a trailing synteny file clamps to the last (only) level
    expect(syntenyTracks[0]!.assemblyNames).toEqual(['a.fa', 'b.fa'])
  })

  test('a key:value modifier overrides the legacy per-index flag', () => {
    const { locs } = buildComparative([
      ['fasta', ['a.fa', 'loc:chrX']],
      ['loc', ['chr1']],
      ['fasta', ['b.fa']],
    ])
    expect(locs[0]).toBe('chrX')
  })

  test('a synteny file with no second assembly throws', () => {
    expect(() =>
      buildComparative([
        ['fasta', ['a.fa']],
        ['paf', ['a_b.paf']],
      ]),
    ).toThrow(/second assembly/)
  })

  test('an assembly flag with no file throws', () => {
    expect(() => buildComparative([['fasta', []]])).toThrow(/requires a file/)
  })
})
