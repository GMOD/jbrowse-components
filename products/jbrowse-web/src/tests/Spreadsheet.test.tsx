import '@testing-library/jest-dom'

import { screen } from '@testing-library/react'

import { doBeforeEach, openSpreadsheetView, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

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
