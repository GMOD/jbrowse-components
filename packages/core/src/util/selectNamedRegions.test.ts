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
})
