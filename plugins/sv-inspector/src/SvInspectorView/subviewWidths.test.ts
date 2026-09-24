import { openInspector } from './testUtils.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

test('an out-of-range fraction draws clamped', async () => {
  const { view } = await openInspector({ spreadsheetWidthFraction: 0.95 })
  expect(view.subviewWidths).toEqual({ spreadsheet: 800, circular: 200 })
})

test('dragging from an out-of-range fraction moves the divider at once', async () => {
  const { view } = await openInspector({ spreadsheetWidthFraction: 0.95 })
  view.resizeSpreadsheetWidth(-10)
  expect(view.subviewWidths).toEqual({ spreadsheet: 790, circular: 210 })
})
