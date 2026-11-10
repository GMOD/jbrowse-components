import { fireEvent, render, screen, within } from '@testing-library/react'

import BandChips from './components/BandChips.tsx'
import RecordsBandOverlay from './components/RecordsBandOverlay.tsx'
import { recordsDisplayAt } from './recordsBand.fixture.ts'

import type { BandRecord } from './recordsBand.fixture.ts'

const FEW: BandRecord[] = [
  ['rs1', 1000, 1001, 'A -> G', ''],
  ['sv1', 2000, 9000, '<DEL> 7Kbp', 'DEL'],
]

test('the records hide from their chip and come back from the rows', () => {
  const { display } = recordsDisplayAt(FEW, 10)
  const height = display.height
  render(<BandChips model={display} />)

  fireEvent.click(screen.getByTitle('Hide records'))
  expect(display.showRecords).toBe(false)
  expect(display.height).toBeLessThan(height)
  expect(screen.queryByTitle('Hide genotypes')).toBeNull()

  fireEvent.click(screen.getByTestId('show_records_chip'))
  expect(display.showRecords).toBe(true)
  expect(display.height).toBe(height)
})

test('the genotypes hide from their chip and come back at their height', () => {
  const { display } = recordsDisplayAt(FEW, 10)
  const rowsHeight = display.availableHeight
  render(<BandChips model={display} />)

  fireEvent.click(screen.getByTitle('Hide genotypes'))
  expect(display.drawsGenotypeRows).toBe(false)
  expect(display.availableHeight).toBe(0)
  expect(screen.queryByTitle('Hide records')).toBeNull()

  fireEvent.click(screen.getByTestId('show_genotypes_chip'))
  expect(display.drawsGenotypeRows).toBe(true)
  expect(display.availableHeight).toBe(rowsHeight)
})

test('a VCF with no samples draws no chip', () => {
  const { display } = recordsDisplayAt(FEW, 10, {}, false)
  const { container } = render(<BandChips model={display} />)
  expect(container.childElementCount).toBe(0)
})

test('each chip heads its own part: records at the band top, genotypes above the rows', () => {
  const { display } = recordsDisplayAt(FEW, 10)
  render(<BandChips model={display} />)
  const top = screen.getByTestId('records_band_chips')
  const strip = screen.getByTestId('band_chips_strip')
  expect(top.style.top).toBe('1px')
  expect(strip.style.top).toBe(`${display.topBands.top.chips + 2}px`)
  expect(within(top).getByTitle('Hide records')).toBeTruthy()
  expect(within(strip).getByTitle('Hide genotypes')).toBeTruthy()
  expect(within(strip).queryByTitle('Hide records')).toBeNull()
})

test('with the rows hidden the records keep the strip, clear of the track label', () => {
  const { display } = recordsDisplayAt(FEW, 10)
  render(<BandChips model={display} />)
  fireEvent.click(screen.getByTitle('Hide genotypes'))
  expect(screen.queryByTestId('records_band_chips')).toBeNull()
  expect(
    within(screen.getByTestId('band_chips_strip')).getByTestId(
      'show_genotypes_chip',
    ),
  ).toBeTruthy()
})

test('sectioned records carry their chip ahead of the topmost section chip', () => {
  const { display } = recordsDisplayAt(
    [
      ['a', 1000, 5000, 'DEL', 'DEL', { groupKey: 'Benign' }],
      ['b', 2000, 6000, 'DEL', 'DEL', { groupKey: 'Pathogenic' }],
    ],
    10,
    { facet: 'INFO.CLNSIG' },
  )
  render(
    <>
      <RecordsBandOverlay model={display} />
      <BandChips model={display} />
    </>,
  )
  const [topmost] = screen.getAllByTestId('group-label-chip')
  expect(within(topmost!).getByTitle('Hide records')).toBeTruthy()
  expect(screen.getAllByTitle('Hide records')).toHaveLength(1)
  expect(screen.queryByTestId('records_band_chips')).toBeNull()
  expect(
    within(screen.getByTestId('band_chips_strip')).getByTitle('Hide genotypes'),
  ).toBeTruthy()
})
