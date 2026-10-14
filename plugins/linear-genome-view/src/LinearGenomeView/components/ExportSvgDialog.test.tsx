import '@testing-library/jest-dom'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, waitFor } from '@testing-library/react'

import ExportSvgDialog from './ExportSvgDialog.tsx'

import type { ViewTrackLabelMode } from '../types.ts'

function stubView(effectiveTrackLabels: ViewTrackLabelMode, width = 1234) {
  const exportSvg = jest.fn().mockResolvedValue(undefined)
  return types
    .model('Session', {
      rpcManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      view: types.optional(
        types
          .model('View', {})
          .volatile(() => ({ effectiveTrackLabels, exportSvg, width })),
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

async function exportedViewWidth(chooseWidth: boolean, typed?: string) {
  const model = stubView('offset')
  const { getByRole, queryByLabelText, getByLabelText, unmount } = render(
    <ExportSvgDialog
      model={model}
      handleClose={() => {}}
      chooseWidth={chooseWidth}
    />,
  )
  if (!chooseWidth) {
    expect(queryByLabelText('Width (px)')).toBeNull()
  } else if (typed !== undefined) {
    fireEvent.change(getByLabelText('Width (px)'), {
      target: { value: typed },
    })
  }
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(model.exportSvg).toHaveBeenCalled()
  })
  unmount()
  return model.exportSvg.mock.calls[0][0].viewWidth
}

test('the width field starts at the view width and sends what is typed', async () => {
  expect(await exportedViewWidth(true)).toBe(1234)
  expect(await exportedViewWidth(true, '800')).toBe(800)
})

test('a width out of range does not export', () => {
  const model = stubView('offset')
  const { getByRole, getByLabelText } = render(
    <ExportSvgDialog model={model} handleClose={() => {}} chooseWidth />,
  )
  fireEvent.change(getByLabelText('Width (px)'), { target: { value: '50' } })
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  expect(getByLabelText('Width (px)')).toBeInvalid()
  expect(model.exportSvg).not.toHaveBeenCalled()
})

test('a view that does not opt in shows no width field and sends none', async () => {
  expect(await exportedViewWidth(false)).toBeUndefined()
})
