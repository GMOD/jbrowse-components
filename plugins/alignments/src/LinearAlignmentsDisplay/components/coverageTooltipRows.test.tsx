import { resolvePalette } from '@jbrowse/core/ui/palette'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import { buildBaseCssMap } from '../../features/mismatch/baseColors.ts'
import { CoverageTooltipContents } from './AlignmentsTooltip.tsx'
import { buildColorPaletteFromPalette } from './alignmentComponentUtils.ts'

import type { CoverageBin } from './tooltipUtils.ts'

const baseColors = buildBaseCssMap({
  colors: buildColorPaletteFromPalette(resolvePalette()),
  showModifications: false,
})

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
      <CoverageTooltipContents bin={b} refName="chr1" baseColors={baseColors} />
    </ThemeProvider>,
  )
  return [...container.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td, th')].map(td => td.textContent).join('|'),
  )
}

// The swatch cell holds no text, so `rows` cannot see it. This reads the colour
// off the element instead, per row label. Spaces are stripped because jsdom
// re-serializes an inline style through the CSSOM (`rgb(0, 0, 255)`) while
// `rgb255` emits none.
function swatchOf(b: CoverageBin, label: string) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CoverageTooltipContents bin={b} refName="chr1" baseColors={baseColors} />
    </ThemeProvider>,
  )
  const tr = [...container.querySelectorAll('tr')].find(
    r => r.querySelectorAll('td')[1]?.textContent === label,
  )
  const swatch = tr?.querySelector<HTMLElement>('td div')
  return swatch?.style.background.replaceAll(' ', '')
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

  // Nothing to weigh it against, so no row rather than a "20/20 (100.0%)" one
  // on every hover over ordinary coverage.
  it('drops the reference row where there is no alt', () => {
    expect(rows(bin({ depth: 20 })).join('\n')).not.toContain('Ref')
  })

  // Insertion order is mismatch-array order, so the same locus listed its
  // alleles differently after a pan; the tiebreak is what stops two alleles at
  // equal depth still flipping.
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

  it('swatches an allele row with the colour its coverage bar is drawn in', () => {
    const b = bin({ snps: { C: { count: 3, fwd: 2, rev: 1 } } })
    expect(swatchOf(b, 'C')).toBe(baseColors['C'.charCodeAt(0)])
    // Nothing names the reference base, so that row has no swatch
    expect(swatchOf(b, 'Ref')).toBeUndefined()
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
    expect(out).toContain('|A|2|2(+) 0(-)')
  })
})
