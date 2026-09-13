import '@testing-library/jest-dom'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, waitFor } from '@testing-library/react'

import ExportSvgDialog from './ExportSvgDialog.tsx'

function stubView(effectiveTrackLabels: string) {
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

async function exportedTrackLabels(effectiveTrackLabels: string) {
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

// A user who has not picked a placement here gets the one the view shows.
test.each([
  ['hidden', 'none'],
  ['overlapping', 'overlay'],
  ['offset', 'offset'],
])('a view with %s labels exports %s by default', async (view, exported) => {
  expect(await exportedTrackLabels(view)).toBe(exported)
})

test('a placement picked in the dialog before still wins', async () => {
  localStorage.setItem('svg-tracklabels', JSON.stringify('left'))
  expect(await exportedTrackLabels('hidden')).toBe('left')
})
