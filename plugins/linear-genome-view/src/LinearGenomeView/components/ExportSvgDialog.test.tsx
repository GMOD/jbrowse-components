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

function figureLayout(plotPx: number) {
  return {
    chromePx: () => 100,
    pageLayout: (opts: { textSize?: number }) => {
      const textPt = opts.textSize ?? 7
      return {
        pageWidth: { value: 183, unit: 'mm' as const },
        textPt,
        pageHeight: 145,
        scale: textPt / 9.75,
        documentPx: plotPx + 100,
        plotPx,
        rasterScale: 3.125,
      }
    },
  }
}

function renderWithLayout(plotPx: number, width = 1600) {
  const model = stubView('offset', width)
  const rendered = render(
    <ExportSvgDialog
      model={model}
      handleClose={() => {}}
      figureLayout={figureLayout(plotPx)}
    />,
  )
  return { model, ...rendered }
}

async function exportedViewWidth(typed?: string) {
  const { model, getByRole, getByLabelText, unmount } = renderWithLayout(
    800,
    1234,
  )
  if (typed !== undefined) {
    fireEvent.change(getByLabelText('Width'), { target: { value: typed } })
  }
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(model.exportSvg).toHaveBeenCalled()
  })
  unmount()
  return model.exportSvg.mock.calls[0][0].viewWidth
}

test('the width field starts at the view width and sends what is typed', async () => {
  expect(await exportedViewWidth()).toBe(1234)
  expect(await exportedViewWidth('800')).toBe(800)
})

test('a width out of range does not export', () => {
  const { model, getByRole, getByLabelText } = renderWithLayout(800)
  fireEvent.change(getByLabelText('Width'), { target: { value: '50' } })
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  expect(getByLabelText('Width')).toBeInvalid()
  expect(model.exportSvg).not.toHaveBeenCalled()
})

test('a view with no figure layout shows no width field and sends none', async () => {
  const model = stubView('offset')
  const { getByRole, queryByLabelText } = render(
    <ExportSvgDialog model={model} handleClose={() => {}} />,
  )
  expect(queryByLabelText('Width')).toBeNull()
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(model.exportSvg).toHaveBeenCalled()
  })
  expect(model.exportSvg.mock.calls[0][0]).toMatchObject({
    viewWidth: undefined,
    pageWidth: undefined,
  })
})

test('a px width says what its labels print at in a journal column', () => {
  const { getByText } = renderWithLayout(800)
  expect(
    getByText(/In a 183 mm column its labels print at 4 pt; type 183mm/),
  ).toBeInTheDocument()
})

test('a width with a unit exports a page width at the text size', async () => {
  const { model, getByLabelText, getByRole, getByText, queryByLabelText } =
    renderWithLayout(800)
  expect(queryByLabelText('Text size (pt)')).toBeNull()
  fireEvent.change(getByLabelText('Width'), { target: { value: '183mm' } })
  expect(
    getByText(
      "183 x 145 mm. Labels 7 pt, ruler 5.9 pt, axes 5.4 pt. Tracks drawn 800 px wide, 2x the screen's bp per px.",
    ),
  ).toBeInTheDocument()
  fireEvent.change(getByLabelText('Text size (pt)'), {
    target: { value: '8' },
  })
  fireEvent.click(getByRole('button', { name: 'Submit' }))
  await waitFor(() => {
    expect(model.exportSvg).toHaveBeenCalled()
  })
  expect(model.exportSvg.mock.calls[0][0]).toMatchObject({
    pageWidth: '183mm',
    textSize: 8,
    viewWidth: undefined,
  })
})

test('a page too narrow for its text says so and does not export', () => {
  const { model, getByLabelText, getByRole, getByText } = renderWithLayout(110)
  fireEvent.change(getByLabelText('Width'), { target: { value: '40mm' } })
  expect(
    getByText(
      'Too narrow at 7 pt: the tracks would be 110 px wide. Widen the figure or lower the text size.',
    ),
  ).toBeInTheDocument()
  expect(getByRole('button', { name: 'Submit' })).toBeDisabled()
  expect(model.exportSvg).not.toHaveBeenCalled()
})
