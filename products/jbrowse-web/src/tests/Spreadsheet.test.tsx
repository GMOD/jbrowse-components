import '@testing-library/jest-dom'

import { toLocale } from '@jbrowse/core/util'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { doBeforeEach, openSpreadsheetView, setup } from './util.tsx'

import type { SpreadsheetViewModel } from '@jbrowse/plugin-spreadsheet-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }

test('opens a vcf.gz file in the spreadsheet view', async () => {
  const { session } = await openSpreadsheetView({
    screen,
    fileUrl: 'volvox.filtered.vcf.gz',
  })
  expect(session.views.length).toBe(2)
}, 50000)

test('opens a bed.gz file in the spreadsheet view', async () => {
  const { session } = await openSpreadsheetView({
    screen,
    fileUrl: 'volvox-bed12.bed.gz',
  })
  expect(session.views.length).toBe(2)
}, 50000)

test('a header click sorts the rows, and the search box narrows them', async () => {
  const { session } = await openSpreadsheetView({
    screen,
    fileUrl: 'volvox.filtered.vcf.gz',
  })
  const sheet = (session.views.at(-1) as SpreadsheetViewModel).spreadsheet!
  const table = await screen.findByTestId(
    'spreadsheet-view-data-grid',
    {},
    delay,
  )
  const posHeader = () => within(table.querySelector('thead')!).getByText('POS')
  fireEvent.click(posHeader())
  fireEvent.click(posHeader())
  expect(sheet.sortField).toBe('POS')
  expect(sheet.sortAscending).toBe(false)
  const positions = sheet.sortedRows.map(row => Number(row.POS))
  expect(positions).toEqual(positions.toSorted((a, b) => b - a))
  expect(within(table).getAllByText(toLocale(positions[0]!)).length).toBe(1)

  const total = sheet.rows!.length
  fireEvent.change(screen.getByLabelText('Search rows'), {
    target: { value: '1694' },
  })
  await waitFor(() => {
    expect(sheet.visibleRows!.length).toBeLessThan(total)
  }, delay)
  expect(sheet.visibleRows!.length).toBeGreaterThan(0)
  await screen.findByText(`${sheet.visibleRows!.length} of ${total}`, {}, delay)
}, 50000)
