import { fireEvent, render, screen } from '@testing-library/react'

import BandChips from './components/BandChips.tsx'
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
  expect(display.drawsRows).toBe(false)
  expect(display.availableHeight).toBe(0)
  expect(screen.queryByTitle('Hide records')).toBeNull()

  fireEvent.click(screen.getByTestId('show_genotypes_chip'))
  expect(display.drawsRows).toBe(true)
  expect(display.availableHeight).toBe(rowsHeight)
})

test('a VCF with no samples draws no chip', () => {
  const { display } = recordsDisplayAt(FEW, 10, {}, false)
  const { container } = render(<BandChips model={display} />)
  expect(container.childElementCount).toBe(0)
})
