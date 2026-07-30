import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import { CoverageTooltipContents } from './AlignmentsTooltip.tsx'

import type { CoverageBin } from './tooltipUtils.ts'

function bin(overrides: Partial<CoverageBin> = {}): CoverageBin {
  return {
    position: 100,
    depth: 10,
    snps: {},
    ...overrides,
  }
}

// Row text is read off the whole table rather than per-cell: the assertions are
// about which rows exist and what denominator they report, not about layout.
function rows(b: CoverageBin) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CoverageTooltipContents bin={b} refName="chr1" />
    </ThemeProvider>,
  )
  return [...container.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td, th')].map(td => td.textContent).join('|'),
  )
}

const MOD_5MC = {
  name: '5mC',
  color: 'red',
  count: 8,
  fwd: 5,
  rev: 3,
  // 8 calls averaging 0.8
  probabilityTotal: 6.4,
}

describe('coverage tooltip rows', () => {
  it('reports depth and the per-base breakdown', () => {
    expect(rows(bin({ snps: { C: { count: 3, fwd: 2, rev: 1 } } }))).toEqual([
      'Base|Reads|Strands',
      'Total|10|',
      'C|3/10 (30.0%)|2(+) 1(-)',
    ])
  })

  // The bug this pins: the SNP rows used to be replaced by the modification
  // rows, so on a modBAM every hovered base showed methylation calls and no
  // A/C/G/T breakdown at all — exactly the pair worth disambiguating at a CpG.
  it('keeps the per-base breakdown when the position also has modifications', () => {
    const out = rows(
      bin({
        snps: { C: { count: 3, fwd: 2, rev: 1 } },
        modifications: [MOD_5MC],
      }),
    )
    expect(out).toContain('|5mC|8/10 (80.0%)|80.0%|5(+) 3(-)')
    expect(out).toContain('|C|3/10 (30.0%)||2(+) 1(-)')
  })

  it('adds the modification columns to the header, and pads the other rows', () => {
    const out = rows(bin({ modifications: [MOD_5MC] }))
    expect(out[0]).toBe('|Base|Reads|Avg Prob|Strands')
    // Total row keeps the swatch and Avg Prob cells empty rather than shifting
    // the columns it does fill.
    expect(out[1]).toBe('|Total|10||')
  })

  it('measures deletions against depth + deletions, not depth', () => {
    const out = rows(
      bin({
        depth: 5,
        deletions: { count: 3, minLen: 2, maxLen: 2, avgLen: 2 },
      }),
    )
    // 3 of 8 reads at this position carry the deletion, not 3 of 5
    expect(out).toContain('Deletion (2bp)|3/8 (37.5%)')
  })

  it('splits the total by strand when the sweep collected per-strand depth', () => {
    const out = rows(bin({ depth: 10, fwdDepth: 6, revDepth: 4 }))
    expect(out).toContain('Total|10|6(+) 4(-)')
  })

  // A zero denominator can't express a share; the row reports the bare count.
  it('drops the percentage when depth is zero', () => {
    const out = rows(
      bin({ depth: 0, snps: { A: { count: 2, fwd: 2, rev: 0 } } }),
    )
    expect(out).toContain('A|2|2(+) 0(-)')
  })
})
