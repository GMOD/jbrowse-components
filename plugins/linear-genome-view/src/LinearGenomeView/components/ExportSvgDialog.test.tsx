import '@testing-library/jest-dom'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, waitFor } from '@testing-library/react'

import ExportSvgDialog from './ExportSvgDialog.tsx'

import type { ViewTrackLabelMode } from '../types.ts'

function stubView(effectiveTrackLabels: ViewTrackLabelMode) {
  const exportSvg = jest.fn().mockResolvedValue(undefined)
  return types
    .model('Session', {
      rpcManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      view: types.optional(
        types
          .model('View', {})
          .volatile(() => ({ effectiveTrackLabels, exportSvg })),
        {},
      ),
    })
    .views(() => ({
      allThemes: () => ({ default: { name: 'Default' } }),
      get themeName() {
        return 'default'
      },
    }))
    .create({}).view
}

async function exportedTrackLabels(effectiveTrackLabels: ViewTrackLabelMode) {
  const model = stubView(effectiveTrackLabels)
  const { getByRole } = render(
    <ExportSvgDialog model={model} handleClose={() => {}} />,
  )
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(model.exportSvg).toHaveBeenCalled()
  })
  return model.exportSvg.mock.calls[0][0].trackLabels
}

beforeEach(() => {
  localStorage.clear()
})

// A user who has not picked a placement here gets the one the view shows —
// which is the whole point of the shared vocabulary: no mode is translated on
// the way to the export.
test.each(['hidden', 'overlapping', 'offset'] as const)(
  'a view with %s labels exports the same by default',
  async view => {
    expect(await exportedTrackLabels(view)).toBe(view)
  },
)

test('a placement picked in the dialog before still wins', async () => {
  localStorage.setItem('svg-tracklabels-mode', JSON.stringify('left'))
  expect(await exportedTrackLabels('hidden')).toBe('left')
})
