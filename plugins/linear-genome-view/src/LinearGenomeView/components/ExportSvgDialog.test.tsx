import '@testing-library/jest-dom'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, waitFor, within } from '@testing-library/react'

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

function figureLayout(plotPx: number) {
  return {
    pageLayout: (opts: { textSize?: number }) => {
      const textPt = opts.textSize ?? 7
      return {
        pageWidth: { value: 183, unit: 'mm' as const },
        textPt,
        scale: textPt / 9.75,
        documentPx: plotPx + 100,
        plotPx,
        rasterScale: 3.125,
      }
    },
  }
}

function renderWithLayout(plotPx = 800) {
  const model = stubView('offset')
  const rendered = render(
    <ExportSvgDialog
      model={model}
      handleClose={() => {}}
      figureLayout={figureLayout(plotPx)}
    />,
  )
  return { model, ...rendered }
}

async function submitted(
  model: ReturnType<typeof stubView>,
  getByRole: ReturnType<typeof render>['getByRole'],
) {
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(model.exportSvg).toHaveBeenCalled()
  })
  return model.exportSvg.mock.calls[0][0]
}

function pick(
  getByRole: ReturnType<typeof render>['getByRole'],
  combobox: string,
  option: string,
) {
  fireEvent.mouseDown(getByRole('combobox', { name: combobox }))
  fireEvent.click(
    within(getByRole('listbox')).getByRole('option', { name: option }),
  )
}

test('the size starts as the screen, with no width field, and sends no page width', async () => {
  const { model, getByRole, queryByLabelText } = renderWithLayout()
  expect(getByRole('combobox', { name: 'Size' })).toHaveTextContent(
    'Same as screen',
  )
  expect(queryByLabelText('Width')).toBeNull()
  expect(await submitted(model, getByRole)).toMatchObject({
    pageWidth: undefined,
    textSize: undefined,
  })
})

test('a page width exports at 183 mm and 7 pt until changed', async () => {
  const { model, getByRole, getByLabelText } = renderWithLayout()
  pick(getByRole, 'Size', 'Page width')
  expect(getByLabelText('Width')).toHaveValue('183')
  fireEvent.change(getByLabelText('Text size'), { target: { value: '8' } })
  expect(await submitted(model, getByRole)).toMatchObject({
    pageWidth: '183mm',
    textSize: 8,
  })
})

test('the page width is remembered', async () => {
  localStorage.setItem('svg-size', JSON.stringify('page'))
  localStorage.setItem('svg-page-width', JSON.stringify('89'))
  const { model, getByRole } = renderWithLayout()
  expect(await submitted(model, getByRole)).toMatchObject({
    pageWidth: '89mm',
    textSize: 7,
  })
})

test('switching the unit converts the width', async () => {
  localStorage.setItem('svg-size', JSON.stringify('page'))
  const { model, getByRole, getByLabelText } = renderWithLayout()
  pick(getByRole, 'Width unit', 'in')
  expect(getByLabelText('Width')).toHaveValue('7.2')
  expect(await submitted(model, getByRole)).toMatchObject({
    pageWidth: '7.2in',
  })
})

test('a page too narrow for its text says so and does not export', () => {
  localStorage.setItem('svg-size', JSON.stringify('page'))
  const { model, getByRole, getByText } = renderWithLayout(110)
  expect(getByText('Too narrow for 7 pt')).toBeInTheDocument()
  expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
  expect(model.exportSvg).not.toHaveBeenCalled()
})

test('a text size out of range says so and does not export', () => {
  localStorage.setItem('svg-size', JSON.stringify('page'))
  const { getByRole, getByLabelText, getByText } = renderWithLayout()
  fireEvent.change(getByLabelText('Text size'), { target: { value: '2' } })
  expect(getByText('4 to 72 pt')).toBeInTheDocument()
  expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
})

test('a view with no figure layout shows no size field and sends no page width', async () => {
  localStorage.setItem('svg-size', JSON.stringify('page'))
  const model = stubView('offset')
  const { getByRole, queryByRole } = render(
    <ExportSvgDialog model={model} handleClose={() => {}} />,
  )
  expect(queryByRole('combobox', { name: 'Size' })).toBeNull()
  expect(await submitted(model, getByRole)).toMatchObject({
    pageWidth: undefined,
  })
})
