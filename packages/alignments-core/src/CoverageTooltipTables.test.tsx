import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import {
  CoverageTooltipTable,
  InterbaseTooltipTable,
} from './CoverageTooltipTables.tsx'

import type { CoverageRowsBin } from './coverageBandTooltip.ts'

const SWATCH: Record<string, string> = { C: 'rgb(0,0,255)', A: 'rgb(0,255,0)' }

function bin(overrides: Partial<CoverageRowsBin> = {}): CoverageRowsBin {
  return {
    position: 100,
    depth: 10,
    snps: {},
    ...overrides,
  }
}

function tableRows(container: HTMLElement) {
  return [...container.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td, th')].map(td => td.textContent).join('|'),
  )
}

// Row text is read off the whole table rather than per-cell: the assertions are
// about which rows exist and what denominator they report, not about layout.
function rows(b: CoverageRowsBin, unit?: string) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CoverageTooltipTable
        bin={b}
        location="chr1:101"
        unit={unit}
        swatchFor={base => SWATCH[base]}
      />
    </ThemeProvider>,
  )
  return tableRows(container)
}

// The swatch cell holds no text, so `rows` cannot see it. Spaces are stripped
// because jsdom re-serializes an inline style through the CSSOM.
function swatchOf(b: CoverageRowsBin, label: string) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CoverageTooltipTable
        bin={b}
        location="chr1:101"
        swatchFor={base => SWATCH[base]}
      />
    </ThemeProvider>,
  )
  const tr = [...container.querySelectorAll('tr')].find(
    r => r.querySelectorAll('td')[1]?.textContent === label,
  )
  return tr
    ?.querySelector<HTMLElement>('td div')
    ?.style.background.replaceAll(' ', '')
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

describe('the coverage table', () => {
  it('reports depth and the per-base breakdown', () => {
    expect(rows(bin({ snps: { C: { count: 3, fwd: 2, rev: 1 } } }))).toEqual([
      '|Base|Reads|Strands',
      '|Total|10|',
      '|Ref|7/10 (70.0%)|',
      '|C|3/10 (30.0%)|2(+) 1(-)',
    ])
  })

  // The count a reader at a het site is after, which the table used to leave
  // them to work out as depth minus the sum of the alts.
  it('reports the reference allele as its own row', () => {
    const out = rows(
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
    expect(out).toContain('|Ref|12/20 (60.0%)|7(+) 5(-)')
  })

  it('drops the reference row where there is no alt', () => {
    expect(rows(bin({ depth: 20 })).join('\n')).not.toContain('Ref')
  })

  it('orders the alleles by count, then by base', () => {
    const out = rows(
      bin({
        depth: 30,
        snps: {
          T: { count: 4, fwd: 2, rev: 2 },
          G: { count: 9, fwd: 5, rev: 4 },
          C: { count: 4, fwd: 2, rev: 2 },
        },
      }),
    )
    expect(out.slice(3).map(r => r.split('|')[1])).toEqual(['G', 'C', 'T'])
  })

  it('swatches an allele row with the colour the display hands it', () => {
    const b = bin({ snps: { C: { count: 3, fwd: 2, rev: 1 } } })
    expect(swatchOf(b, 'C')).toBe('rgb(0,0,255)')
    // Nothing names the reference base, so that row has no swatch
    expect(swatchOf(b, 'Ref')).toBeUndefined()
  })

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
    expect(out[1]).toBe('|Total|10||')
  })

  // A display counting samples rather than reads, with no strand tally and no
  // swatch palette: the table shrinks to what the bin holds.
  it('names the unit the display counts, and drops the columns it has no data for', () => {
    const { container } = render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <CoverageTooltipTable
          bin={bin({ depth: 3, snps: { T: { count: 1, fwd: 0, rev: 0 } } })}
          location="chr1:101"
          unit="Samples"
        >
          <div>Identity: 66.7%</div>
        </CoverageTooltipTable>
      </ThemeProvider>,
    )
    expect(tableRows(container)).toEqual([
      'Base|Samples',
      'Total|3',
      'Ref|2/3 (66.7%)',
      'T|1/3 (33.3%)',
    ])
    expect(container.textContent).toContain('Identity: 66.7%')
  })
})

describe('the interbase table', () => {
  it('lists each type against the boundary depth, with its size range', () => {
    const { container } = render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <InterbaseTooltipTable
          interbase={{
            insertion: { count: 2, minLen: 2, maxLen: 6, avgLen: 4 },
            softclip: {
              count: 1,
              minLen: 5,
              maxLen: 5,
              avgLen: 5,
              topSeq: 'ACGTA',
              topSeqCount: 1,
            },
          }}
          total={10}
          location="chr1:101"
          typeLabel={t => (t === 'softclip' ? 'Soft clip' : 'Insertion')}
        />
      </ThemeProvider>,
    )
    expect(tableRows(container)).toEqual([
      'Type|Reads|Size',
      'Total|10|',
      'Insertion|2/10 (20.0%)|2-6bp',
      'Soft clip (most frequent ACGTA)|1/10 (10.0%)|5bp',
    ])
  })

  // `interbaseDepthAt` is 0 for an event at the edge of the coverage array,
  // and a share of nothing is not a number.
  it('reports a bare count against a zero total', () => {
    const { container } = render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <InterbaseTooltipTable
          interbase={{
            insertion: { count: 3, minLen: 1, maxLen: 1, avgLen: 1 },
          }}
          total={0}
          location="chr1:101"
          unit="Samples"
        />
      </ThemeProvider>,
    )
    expect(tableRows(container)[2]).toBe('Insertion|3|1bp')
  })
})
