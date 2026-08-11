import { selectNamedRegions } from './selectNamedRegions.ts'

import type { Region } from './types/index.ts'

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
