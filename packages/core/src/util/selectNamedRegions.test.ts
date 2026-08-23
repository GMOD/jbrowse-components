import {
  parseRegionNames,
  resolveNamedRegions,
  selectNamedRegions,
} from './selectNamedRegions.ts'

import type { Region } from './types/data.ts'

function region(refName: string): Region {
  return { refName, start: 0, end: 100, assemblyName: 'asm' }
}

const hap = [
  region('chr1_hap1'),
  region('chr2_hap1'),
  region('chr1_hap2'),
  region('chr2_hap2'),
  region('chrUn'),
]
const identity = (n: string) => n

describe('selectNamedRegions', () => {
  it('selects exact names in the caller order', () => {
    expect(
      selectNamedRegions(hap, ['chr2_hap2', 'chr1_hap1'], identity).map(
        r => r.refName,
      ),
    ).toEqual(['chr2_hap2', 'chr1_hap1'])
  })

  it('expands a glob in assembly order', () => {
    expect(
      selectNamedRegions(hap, ['*_hap1'], identity).map(r => r.refName),
    ).toEqual(['chr1_hap1', 'chr2_hap1'])
  })

  it('drops names matching nothing', () => {
    expect(selectNamedRegions(hap, ['nope', '*_hap3'], identity)).toEqual([])
  })

  it('dedupes across entries, keeping first position', () => {
    expect(
      selectNamedRegions(hap, ['chr2_hap1', '*_hap1'], identity).map(
        r => r.refName,
      ),
    ).toEqual(['chr2_hap1', 'chr1_hap1'])
  })

  it('resolves an exact name through the alias callback', () => {
    const canonical = (n: string) => (n === '1_hap1' ? 'chr1_hap1' : n)
    expect(
      selectNamedRegions(hap, ['1_hap1'], canonical).map(r => r.refName),
    ).toEqual(['chr1_hap1'])
  })

  it('treats regex punctuation in a name literally', () => {
    const dotty = [region('chr1.1'), region('chr1x1')]
    expect(
      selectNamedRegions(dotty, ['chr1.1'], identity).map(r => r.refName),
    ).toEqual(['chr1.1'])
  })

  it('anchors globs, so a prefix does not match a longer name', () => {
    expect(
      selectNamedRegions(hap, ['chr1'], identity).map(r => r.refName),
    ).toEqual([])
  })

  // `*` is a legal character in a contig name and GRCh38's ALT decoys are HLA
  // allele names, so the literal reading has to win or naming one allele silently
  // selects a family. `^HLA-A.*01:01:01:01$` matches both of these.
  const hla = [
    region('HLA-A*01:01:01:01'),
    region('HLA-A*02:53N'),
    region('HLA-A*24:01:01:01'),
  ]

  it('prefers an exact refName over reading its * as a glob', () => {
    expect(
      selectNamedRegions(hla, ['HLA-A*01:01:01:01'], identity).map(
        r => r.refName,
      ),
    ).toEqual(['HLA-A*01:01:01:01'])
  })

  it('still globs a starred name that matches no contig exactly', () => {
    expect(
      selectNamedRegions(hla, ['HLA-A*'], identity).map(r => r.refName),
    ).toEqual(['HLA-A*01:01:01:01', 'HLA-A*02:53N', 'HLA-A*24:01:01:01'])
  })

  // An Ensembl/NCBI-named assembly carrying UCSC aliases, which is the ordinary
  // case for anyone whose FASTA and whose habits disagree
  const ensembl = [region('1'), region('2'), region('MT')]
  const ucscAliases = { chr1: '1', chr2: '2', chrM: 'MT' } as Record<
    string,
    string
  >
  // as an assembly builds it: aliases AND the canonical names, identity-mapped
  const allRefNames = [...Object.keys(ucscAliases), ...['1', '2', 'MT']]
  // mirrors the real getCanonicalRefName, which is
  // `refNameAliases[n] || lowerCaseRefNameAliases[n.toLowerCase()]` — the
  // lowercase fallback is the reason an exact entry has always been
  // case-insensitive, and a fixture without it cannot show the glob failing to
  // match that
  const canonical = (n: string) =>
    ucscAliases[n] ??
    Object.entries(ucscAliases).find(
      ([alias]) => alias.toLowerCase() === n.toLowerCase(),
    )?.[1] ??
    allRefNames.find(r => r.toLowerCase() === n.toLowerCase())

  it('matches a glob against aliases, not only canonical names', () => {
    // the bug this replaced: `chr1` resolved and `chr*` did not, on the same
    // assembly, so the literal worked where the pattern silently found nothing
    expect(
      selectNamedRegions(ensembl, ['chr*'], canonical, allRefNames).map(
        r => r.refName,
      ),
    ).toEqual(['1', '2', 'MT'])
  })

  it('emits alias matches in assembly order, not alias-map order', () => {
    const reversed = ['chrM', 'chr2', 'chr1']
    expect(
      selectNamedRegions(ensembl, ['chr*'], canonical, reversed).map(
        r => r.refName,
      ),
    ).toEqual(['1', '2', 'MT'])
  })

  it('takes a region once when several of its aliases match', () => {
    expect(
      selectNamedRegions(
        [region('1')],
        ['*1'],
        (n: string) => (n === 'chr1' || n === 'NC_1' ? '1' : n),
        ['chr1', 'NC_1', '1'],
      ),
    ).toHaveLength(1)
  })

  it('matches a glob case-insensitively, as the literal beside it already did', () => {
    // getCanonicalRefName falls back to lowerCaseRefNameAliases, so the exact
    // entry has always resolved regardless of casing; a case-sensitive glob was
    // the same literal-works/pattern-silently-fails split as the alias one
    expect(
      selectNamedRegions(ensembl, ['CHR1'], canonical, allRefNames).map(
        r => r.refName,
      ),
    ).toEqual(['1'])
    expect(
      selectNamedRegions(ensembl, ['CHR*'], canonical, allRefNames).map(
        r => r.refName,
      ),
    ).toEqual(['1', '2', 'MT'])
  })

  it('matches canonical names only for a legacy three-argument call', () => {
    // the published ABI's older form, which is the ONLY thing the optional
    // parameter is for — an assembly with regions always has names, since
    // setLoaded writes both in one action
    expect(
      selectNamedRegions(ensembl, ['chr*'], canonical).map(r => r.refName),
    ).toEqual([])
    expect(
      selectNamedRegions(ensembl, ['*'], canonical).map(r => r.refName),
    ).toEqual(['1', '2', 'MT'])
  })

  it('an exact hit does not also pull in the glob reading of the same entry', () => {
    // the entry names one contig, so it contributes one — not that contig plus
    // everything else ending in the same four fields
    expect(
      selectNamedRegions(hla, ['HLA-A*24:01:01:01'], identity).map(
        r => r.refName,
      ),
    ).toEqual(['HLA-A*24:01:01:01'])
  })
})

describe('parseRegionNames', () => {
  it('splits on commas and trims', () => {
    expect(parseRegionNames('chr1, chr2 ,chr3')).toEqual([
      'chr1',
      'chr2',
      'chr3',
    ])
  })

  it('reads a blank, a whitespace-only and a trailing-comma list as no restriction', () => {
    expect(parseRegionNames('')).toEqual([])
    expect(parseRegionNames('   ')).toEqual([])
    expect(parseRegionNames(',,')).toEqual([])
    expect(parseRegionNames('chr1,')).toEqual(['chr1'])
  })

  it('keeps a name containing * intact for selectNamedRegions to resolve', () => {
    // splitting on anything but the comma would break an HLA allele in half
    expect(parseRegionNames('HLA-A*01:01:01:01')).toEqual(['HLA-A*01:01:01:01'])
  })
})

describe('resolveNamedRegions', () => {
  const resolve = (names: string[], notify: (m: string) => void) =>
    resolveNamedRegions({
      regions: hap,
      names,
      assemblyName: 'asm',
      getCanonicalRefName: identity,
      notify,
    })

  it('returns the selection and says nothing when something matched', () => {
    const said: string[] = []
    expect(resolve(['*_hap1'], m => said.push(m))?.map(r => r.refName)).toEqual(
      ['chr1_hap1', 'chr2_hap1'],
    )
    expect(said).toEqual([])
  })

  it('reports a list that matched nothing and leaves the fallback to the caller', () => {
    const said: string[] = []
    expect(resolve(['nope', '*_hap3'], m => said.push(m))).toBeUndefined()
    expect(said).toEqual([
      'displayedRegionNames matched no regions in asm: nope, *_hap3',
    ])
  })

  it('reports a partial miss as a success, since the named part is showable', () => {
    const said: string[] = []
    expect(
      resolve(['chr1_hap1', 'nope'], m => said.push(m))?.map(r => r.refName),
    ).toEqual(['chr1_hap1'])
    expect(said).toEqual([])
  })
})
