import '@testing-library/jest-dom'
import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { doBeforeEach, openSpreadsheetView, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
  const originalWarn = console.warn
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    if (!String(args).includes('unable to determine size of file')) {
      originalWarn.call(console, ...args)
    }
  })
})

test('opens a vcf.gz file in the spreadsheet view', async () => {
  const user = userEvent.setup()
  const { session } = await openSpreadsheetView({
    user,
    screen,
    fileUrl: 'volvox.filtered.vcf.gz',
  })
  expect(session.views.length).toBe(2)
}, 50000)

test('opens a bed.gz file in the spreadsheet view', async () => {
  const user = userEvent.setup()
  const { session } = await openSpreadsheetView({
    user,
    screen,
    fileUrl: 'volvox-bed12.bed.gz',
  })
  expect(session.views.length).toBe(2)
}, 50000)
