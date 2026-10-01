import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'

import PlotDialog from './PlotDialog.tsx'

import type { PlotDialogHost } from './PlotDialog.tsx'
import type { Plot } from '@jbrowse/core/configuration'

const MARKS: Plot = { marks: [{ mark: 'bar', encoding: { y: 'score' } }] }

function setup({
  plot = MARKS,
  seed,
  plotProblems = () => [],
  host = {},
}: {
  plot?: Plot
  seed?: Plot
  plotProblems?: (draft: Plot) => string[]
  host?: Partial<PlotDialogHost>
} = {}) {
  const model = {
    plotKeys: ['marks', 'facet', 'rows', 'scales'],
    plot,
    plotProblems: jest.fn(plotProblems),
    plotWrites: (draft: Plot) =>
      Object.fromEntries(
        Object.entries(draft).filter(
          ([key, value]) => JSON.stringify(value) !== JSON.stringify(plot[key]),
        ),
      ),
    applyPlot: jest.fn(),
    plotExamples: [],
    configDocsUrl: 'https://jbrowse.org/jb2/docs/config/lineartestdisplay/',
    ...host,
  }
  const handleClose = jest.fn()
  render(<PlotDialog model={model} seed={seed} handleClose={handleClose} />)
  const field = screen.getByTestId('plot-json') as HTMLTextAreaElement
  return {
    model,
    handleClose,
    field,
    apply: () => screen.getByRole('button', { name: 'Apply' }),
    type: (value: unknown) => {
      fireEvent.change(field, { target: { value: JSON.stringify(value) } })
    },
  }
}

it('opens on the declared plot', () => {
  const { field } = setup()
  expect(field).toHaveValue(JSON.stringify(MARKS, null, 2))
  expect(screen.getByText('No changes')).toBeInTheDocument()
})

it('keeps the help hidden until asked', () => {
  setup()
  expect(screen.getByText('marks')).not.toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Show help' }))
  expect(screen.getByText('marks')).toBeVisible()
})

it("names and explains only the display's plot keys", () => {
  setup({ host: { plotKeys: ['rows', 'color'] } })
  expect(screen.getByText('rows')).toBeInTheDocument()
  expect(screen.getByText('color')).toBeInTheDocument()
  expect(screen.queryByText('facet')).toBeNull()
})

it('an example button fills the text over the plot as it stands', () => {
  const { field } = setup({
    host: {
      plotExamples: [
        {
          plot: '{ "facet": "strand" }',
          description: 'one section per strand',
        },
      ],
    },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'one section per strand' }),
  )
  expect(JSON.parse(field.value)).toEqual({ ...MARKS, facet: 'strand' })
  expect(screen.getByText('Sets facet')).toBeInTheDocument()
})

it("links the display's config reference", () => {
  setup()
  expect(
    screen.getByRole('link', { name: /Config reference/ }),
  ).toHaveAttribute(
    'href',
    'https://jbrowse.org/jb2/docs/config/lineartestdisplay/',
  )
})

it('seeds over the declared plot without losing the rest', () => {
  const { field } = setup({ seed: { rows: 'source' } })
  expect(field).toHaveValue(
    JSON.stringify({ ...MARKS, rows: 'source' }, null, 2),
  )
})

it('says what a draft sets and resets, and applies it', () => {
  const { type, apply, model, handleClose } = setup({
    plot: { ...MARKS, rows: 'source' },
  })
  const draft = { ...MARKS, facet: 'HP', rows: null }
  type(draft)
  expect(screen.getByText('Sets facet. Resets rows')).toBeInTheDocument()
  fireEvent.click(apply())
  expect(model.applyPlot).toHaveBeenCalledWith(draft)
  expect(handleClose).toHaveBeenCalled()
})

it('writes nothing while the text does not parse', () => {
  const { field, apply, model } = setup()
  fireEvent.change(field, { target: { value: '{ not json' } })
  expect(apply()).toBeDisabled()
  fireEvent.click(apply())
  expect(model.applyPlot).not.toHaveBeenCalled()
})

it('writes nothing for a setting the plot does not hold, and says which under the box', () => {
  const { type, apply, field } = setup()
  type({ ...MARKS, height: 100 })
  expect(apply()).toBeDisabled()
  const message = screen.getByText(/not height/)
  expect(
    field.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

it('writes nothing for a draft the schema refuses', () => {
  const { type, apply } = setup({
    plotProblems: draft => {
      if (JSON.stringify(draft).includes('wiggle')) {
        throw new Error('a mark is one of bar, point')
      }
      return []
    },
  })
  type({ marks: [{ mark: 'wiggle' }] })
  expect(apply()).toBeDisabled()
  expect(screen.getByText(/a mark is one of/)).toBeInTheDocument()
})

// ADR-133: a load refuses none of these, so an editor that did would be
// stricter than both the loader and the display, and the user who hit it would
// have no way forward.
it('applies a draft whose rules report a problem, having said so', () => {
  const { type, apply, model } = setup({
    plotProblems: () => ['mark 0 encoding.y: names no y field'],
  })
  type({ marks: [{ mark: 'bar' }] })
  expect(screen.getByTestId('plot-problems')).toHaveTextContent(
    'names no y field',
  )
  expect(apply()).toBeEnabled()
  fireEvent.click(apply())
  expect(model.applyPlot).toHaveBeenCalledWith({ marks: [{ mark: 'bar' }] })
})

it('leads back to the form with the draft, unapplied', () => {
  const openPlotForm = jest.fn()
  const { type, model, handleClose } = setup({ host: { openPlotForm } })
  const draft = { ...MARKS, scales: { y: { title: 'Score' } } }
  type(draft)
  fireEvent.click(screen.getByText('Back to form'))
  expect(openPlotForm).toHaveBeenCalledWith(draft)
  expect(model.applyPlot).not.toHaveBeenCalled()
  expect(handleClose).toHaveBeenCalled()
})

it('offers no way back to a form the display does not have', () => {
  setup()
  expect(screen.queryByText('Back to form')).toBeNull()
})
