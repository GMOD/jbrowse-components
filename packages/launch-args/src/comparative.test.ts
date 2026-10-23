import {
  buildComparative,
  comparativeRole,
  hasComparativeArgs,
  syntenyTrack,
} from './comparative.ts'
import { fileAdapter } from './fileInput.ts'
import { parseArgv } from './parseArgv.ts'

import type { Entry } from './parseArgv.ts'

const entries = (line: string) => parseArgv(line.split(' '))

describe('hasComparativeArgs', () => {
  test('one genome is a linear view, with or without tracks', () => {
    expect(hasComparativeArgs(entries('--fasta a.fa'))).toBe(false)
    expect(hasComparativeArgs(entries('a.fa reads.bam'))).toBe(false)
    expect(hasComparativeArgs(entries('--chromSizes a.sizes'))).toBe(false)
  })
  test('a second genome or a comparison file is comparative', () => {
    expect(hasComparativeArgs(entries('--fasta a.fa --fasta b.fa'))).toBe(true)
    expect(hasComparativeArgs(entries('a.fa b.2bit'))).toBe(true)
    expect(hasComparativeArgs(entries('--fasta a.fa --paf a_b.paf'))).toBe(true)
    expect(hasComparativeArgs(entries('a.fa a_b.chain.gz'))).toBe(true)
  })
})

describe('buildComparative', () => {
  test('a comparison binds to the gap it sits in', () => {
    const { assemblies, syntenyTracks } = buildComparative(
      entries(
        '--chromSizes a.sizes --paf a_b.paf --chromSizes b.sizes --chain b_c.chain --chromSizes c.sizes',
      ),
    )
    expect(assemblies.map(a => a.name)).toEqual(['a', 'b', 'c'])
    expect(assemblies[0]!.sequence.adapter).toMatchObject({
      type: 'ChromSizesAdapter',
      chromSizesLocation: { localPath: 'a.sizes' },
    })
    expect(syntenyTracks.map(t => t.adapter)).toMatchObject([
      { queryAssembly: 'a', targetAssembly: 'b' },
      { queryAssembly: 'c', targetAssembly: 'b' },
    ])
  })

  test('bare files read the same as their flags', () => {
    const bare = buildComparative(entries('a.fa loc:chr1 a_b.paf b.fa'))
    const flagged = buildComparative(
      entries('--fasta a.fa loc:chr1 --paf a_b.paf --fasta b.fa'),
    )
    expect(bare).toEqual(flagged)
  })

  test('a genome takes loc:, aliases: and cytobands:', () => {
    const data = buildComparative(
      entries('--fasta a.fa loc:chr1 aliases:a.txt --paf a_b.paf --fasta b.fa'),
    )
    expect(data.assemblies[0]!.refNameAliases?.adapter).toMatchObject({
      location: { localPath: 'a.txt' },
    })
    expect(data.rows).toEqual([
      { assembly: 'a.fa', loc: 'chr1' },
      { assembly: 'b.fa' },
    ])
  })

  test('a trailing comparison clamps to the last gap', () => {
    const { syntenyTracks } = buildComparative(
      entries('--fasta a.fa --fasta b.fa --paf a_b.paf name:Aligned'),
    )
    expect(syntenyTracks[0]).toMatchObject({
      assemblyNames: ['a.fa', 'b.fa'],
      name: 'Aligned',
    })
  })

  test('a modifier a genome or comparison has no use for throws', () => {
    expect(() =>
      buildComparative(entries('--fasta a.fa height:100 --fasta b.fa')),
    ).toThrow(
      '--fasta a.fa takes loc:, aliases: and cytobands:, not height:100',
    )
    expect(() =>
      buildComparative(entries('a.fa a_b.paf height:9 b.fa')),
    ).toThrow('a_b.paf takes name:, not height:9')
  })

  test('a comparison with one genome, or a genome flag with no file, throws', () => {
    expect(() =>
      buildComparative(entries('--fasta a.fa --paf a_b.paf')),
    ).toThrow(/a_b\.paf compares two genomes/)
    const noFile: Entry[] = [['fasta', []]]
    expect(() => buildComparative(noFile)).toThrow(/requires a file/)
  })

  test('two genome files of one name throw, naming both', () => {
    expect(() => buildComparative(entries('x/ref.fa a.paf y/ref.fa'))).toThrow(
      'x/ref.fa and y/ref.fa are both named ref.fa',
    )
    expect(() =>
      buildComparative(entries('--chromSizes a.sizes a.chrom.sizes')),
    ).toThrow(/a\.sizes and a\.chrom\.sizes are both named a/)
  })

  // an assembly's name is its config identifier, so a second `a.fa` assembly
  // makes every reference to it ambiguous
  test('one genome file twice is a self-comparison of one assembly', () => {
    const data = buildComparative(entries('a.fa loc:chr1 a_a.paf a.fa'))
    expect(data.assemblies.map(a => a.name)).toEqual(['a.fa'])
    expect(data.rows).toEqual([
      { assembly: 'a.fa', loc: 'chr1' },
      { assembly: 'a.fa' },
    ])
    expect(data.syntenyTracks[0]?.assemblyNames).toEqual(['a.fa', 'a.fa'])
  })

  test('a URL names its genome and comparison without the query', () => {
    const data = buildComparative(
      entries('https://x.test/a.fa?t=1 https://x.test/a_b.paf?t=1 b.fa'),
    )
    expect(data.assemblies.map(a => a.name)).toEqual(['a.fa', 'b.fa'])
    expect(data.syntenyTracks[0]).toMatchObject({
      trackId: 'a_b.paf',
      name: 'a_b.paf',
    })
  })
})

describe('comparativeRole', () => {
  test("an Object.prototype member's name is no comparison flag", () => {
    expect(comparativeRole(['toString', ['x']])).toBeUndefined()
    expect(comparativeRole(['constructor', ['x']])).toBeUndefined()
  })
})

test('an MCScan file cannot be placed from the command line', () => {
  expect(() => buildComparative(entries('a.fa a_b.anchors b.fa'))).toThrow(
    /cannot place/,
  )
})

describe('syntenyTrack', () => {
  test.each([
    ['paf', 'PAFAdapter', 'pafLocation'],
    ['delta', 'DeltaAdapter', 'deltaLocation'],
    ['chain', 'ChainAdapter', 'chainLocation'],
    ['blasttab', 'BlastTabularAdapter', 'blastTableLocation'],
  ])('--%s → %s on slot %s', (flag, adapterType, locSlot) => {
    const { syntenyTracks } = buildComparative(
      entries(`--fasta a.fa --${flag} aln.x --fasta b.fa`),
    )
    expect(syntenyTracks[0]).toMatchObject({
      type: 'SyntenyTrack',
      trackId: 'aln.x',
      adapter: { type: adapterType, [locSlot]: { localPath: 'aln.x' } },
    })
  })

  test('paf: the upper genome is the query', () => {
    const t = syntenyTrack(fileAdapter('a.paf'), 'a.paf', 'upper', 'lower')
    expect(t.adapter).toMatchObject({
      queryAssembly: 'upper',
      targetAssembly: 'lower',
    })
    expect(t.assemblyNames).toEqual(['upper', 'lower'])
  })

  test('chain: the upper genome is the target', () => {
    const t = syntenyTrack(fileAdapter('a.chain'), 'a.chain', 'upper', 'lower')
    expect(t.adapter).toMatchObject({
      queryAssembly: 'lower',
      targetAssembly: 'upper',
    })
    expect(t.assemblyNames).toEqual(['lower', 'upper'])
  })

  test('a remote comparison file is a uri', () => {
    const url = 'https://e.com/a.paf'
    expect(syntenyTrack(fileAdapter(url), url, 'q', 't').adapter).toMatchObject(
      { pafLocation: { uri: url } },
    )
  })
})
