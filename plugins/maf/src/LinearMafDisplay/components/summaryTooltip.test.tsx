import { render } from '@testing-library/react'

import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'

import type { SummaryBar } from './computeVisibleSummaryBars.ts'

const p2 = { refName: 'chr1', coord: 1234 }

const bar = (over: Partial<SummaryBar> = {}): SummaryBar => ({
  x: 0,
  width: 20,
  rowTop: 0,
  h: 12,
  score: 0.873,
  rowIndex: 3,
  start: 1000,
  end: 2500,
  ...over,
})

function rows(node: React.ReactElement) {
  const { container } = render(node)
  return Object.fromEntries(
    [...container.querySelectorAll('tr')].map(tr => {
      const [label, value] = tr.querySelectorAll('td')
      return [label?.textContent ?? '', value?.textContent ?? '']
    }),
  )
}

// Before this the zoom-out tier had no hover at all: `hover` and `codon` both
// resolve against `rpcDataMap`, which the summary fetch clears, so the tooltip
// fell through to the bare "Ref: position" readout over a display whose rows
// are per-species and whose labels are the first thing to go as rows shrink.
describe('the summary tier tooltip', () => {
  it('names the species, the block and the score', () => {
    expect(
      rows(
        <MafAlignmentTooltipContents
          p2={p2}
          summary={bar()}
          summarySampleLabel="panTro6"
        />,
      ),
    ).toEqual({
      Sample: 'panTro6',
      'Aligned block': '1,001-2,500 (1.5Kbp)',
      Score: '0.87',
    })
  })

  // `maf2bed --summary` omits the columns entirely, so absent is the common
  // case and has to read as "nothing to say", not as an empty row.
  it('reports the i-line context on each side when the file carries it', () => {
    expect(
      rows(
        <MafAlignmentTooltipContents
          p2={p2}
          summary={bar({ leftStatus: 'I', rightStatus: 'C' })}
        />,
      ),
    ).toMatchObject({
      'Before block':
        'intervening non-aligning bases between the flanking blocks',
      'After block':
        'contiguous — sequence here was deleted or could not be aligned',
    })
  })

  it('omits the context rows, and the sample row, when nothing names them', () => {
    const table = rows(<MafAlignmentTooltipContents p2={p2} summary={bar()} />)
    expect(table).not.toHaveProperty('Before block')
    expect(table).not.toHaveProperty('After block')
    expect(table).not.toHaveProperty('Sample')
  })

  // The CDS strip draws on this tier too — its frames come from their own
  // sub-adapter, not from the alignment — so the gene still rides along.
  it('keeps the CDS gene alongside it', () => {
    expect(
      rows(
        <MafAlignmentTooltipContents
          p2={p2}
          summary={bar()}
          frame={{ name: 'GAPDH' }}
        />,
      ),
    ).toMatchObject({ Gene: 'GAPDH' })
  })

  // A drag-selection readout outranks everything, on this tier as on the others.
  it('yields to the selection range readout', () => {
    expect(
      rows(
        <MafAlignmentTooltipContents
          p1={{ refName: 'chr1', coord: 1000 }}
          p2={p2}
          summary={bar()}
        />,
      ),
    ).toMatchObject({ Start: 'chr1:1,000', End: 'chr1:1,234' })
  })
})
