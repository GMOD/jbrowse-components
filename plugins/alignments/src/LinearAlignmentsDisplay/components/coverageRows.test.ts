import { coverageWidgetFields } from './detailWidgets.ts'
import { coverageRows } from './tooltipUtils.ts'

import type { CoverageBin } from './tooltipUtils.ts'

function bin(overrides: Partial<CoverageBin> = {}): CoverageBin {
  return {
    position: 100,
    depth: 10,
    snps: {},
    ...overrides,
  }
}

const MOD_5MC = {
  name: '5mC',
  color: 'red',
  count: 8,
  fwd: 5,
  rev: 3,
  probabilityTotal: 6.4,
}

const MOD_5HMC = {
  name: '5hmC',
  color: 'blue',
  count: 2,
  fwd: 1,
  rev: 1,
  probabilityTotal: 1.4,
}

describe('coverageRows', () => {
  it('reports the reference allele against the alts', () => {
    const rows = coverageRows(
      bin({
        depth: 20,
        fwdDepth: 12,
        revDepth: 8,
        snps: {
          A: { count: 6, fwd: 4, rev: 2 },
          T: { count: 2, fwd: 1, rev: 1 },
        },
      }),
    )
    expect(rows.map(r => r.label)).toEqual(['Total', 'Ref', 'A', 'T'])
    expect(rows.find(r => r.key === 'ref')).toEqual({
      key: 'ref',
      label: 'Ref',
      reads: '12/20 (60.0%)',
      strands: '7(+) 5(-)',
    })
  })

  // A zero-depth column that still carries alleles printed a bare "Ref 0".
  it('drops the reference row at depth 0', () => {
    const rows = coverageRows(
      bin({ depth: 0, snps: { A: { count: 2, fwd: 2, rev: 0 } } }),
    )
    expect(rows.map(r => r.key)).toEqual(['total', 'A'])
  })

  it('drops the reference row where there is no alt', () => {
    expect(coverageRows(bin({ depth: 20 })).map(r => r.key)).toEqual(['total'])
  })

  it('measures deletions against depth + deletions', () => {
    const rows = coverageRows(
      bin({
        depth: 5,
        deletions: { count: 3, minLen: 2, maxLen: 2, avgLen: 2 },
      }),
    )
    expect(rows.find(r => r.key === 'deletion')).toEqual({
      key: 'deletion',
      label: 'Deletion (2bp)',
      reads: '3/8 (37.5%)',
    })
  })

  it('sorts the modification rows by name and keeps the alleles', () => {
    const rows = coverageRows(
      bin({
        snps: { C: { count: 3, fwd: 2, rev: 1 } },
        modifications: [MOD_5MC, MOD_5HMC],
      }),
    )
    expect(rows.map(r => r.label)).toEqual(['Total', '5hmC', '5mC', 'Ref', 'C'])
    expect(rows.find(r => r.label === '5mC')?.avgProb).toBe('80.0%')
  })

  // A row reporting "0(+) 0(-)" for want of the data says something false.
  it('omits the strand split where the sweep collected none', () => {
    expect(coverageRows(bin({ depth: 10 }))[0]!.strands).toBeUndefined()
    expect(
      coverageRows(bin({ depth: 10, fwdDepth: 6, revDepth: 4 }))[0]!.strands,
    ).toBe('6(+) 4(-)')
  })
})

describe('coverage detail widget fields', () => {
  it('carries the Ref and Deletion rows the tooltip shows', () => {
    expect(
      coverageWidgetFields(
        bin({
          depth: 20,
          fwdDepth: 12,
          revDepth: 8,
          snps: { A: { count: 6, fwd: 4, rev: 2 } },
          deletions: { count: 4, minLen: 2, maxLen: 5, avgLen: 3 },
        }),
      ),
    ).toEqual({
      Ref: '14/20 (70.0%) (8(+) 6(-))',
      'SNP A': '6/20 (30.0%) (4(+) 2(-))',
      'Deletion (2-5bp)': '4/24 (16.7%)',
    })
  })

  it('names a modification row and reports its average probability', () => {
    expect(coverageWidgetFields(bin({ modifications: [MOD_5MC] }))).toEqual({
      'modification 5mC': '8/10 (80.0%) avg prob 80.0% (5(+) 3(-))',
    })
  })
})
