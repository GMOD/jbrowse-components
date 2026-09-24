import { createTestSession } from '@jbrowse/web/testUtils'

import type { SvInspectorViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function inspector(spreadsheetWidthFraction: number) {
  const session = createTestSession()
  const view = (await session.launchView('SvInspectorView', {
    spreadsheetWidthFraction,
  })) as SvInspectorViewModel
  view.setWidth(1004)
  return view
}

test('an out-of-range fraction draws clamped', async () => {
  const view = await inspector(0.95)
  expect(view.subviewWidths).toEqual({ spreadsheet: 800, circular: 200 })
})

test('dragging from an out-of-range fraction moves the divider at once', async () => {
  const view = await inspector(0.95)
  view.resizeSpreadsheetWidth(-10)
  expect(view.subviewWidths).toEqual({ spreadsheet: 790, circular: 210 })
})
