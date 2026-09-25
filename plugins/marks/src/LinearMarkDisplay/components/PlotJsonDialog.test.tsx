import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { configSchemaFactory } from '../configSchema.ts'
import { liftMarkPlot } from '../markPlot.ts'
import PlotJsonDialog from './PlotJsonDialog.tsx'

import type { MarkPlot } from '../markPlot.ts'
import type { PlotJsonDialogModel } from './PlotJsonDialog.tsx'

const schema = configSchemaFactory()

function setup(markPlot: MarkPlot = {}) {
  const applyDisplaySettings = jest.fn()
  const handleClose = jest.fn()
  const model: PlotJsonDialogModel = {
    markPlot,
    markPlotExamples: [{ plot: '{"facet":"HP"}', description: 'by haplotype' }],
    liftMarkPlot: plot => liftMarkPlot(schema, plot, markPlot),
    applyDisplaySettings,
  }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PlotJsonDialog model={model} handleClose={handleClose} />
    </ThemeProvider>,
  )
  return {
    applyDisplaySettings,
    handleClose,
    apply: () => screen.getByRole('button', { name: 'Apply' }),
    type: (value: unknown) => {
      fireEvent.change(screen.getByTestId('mark-plot-json'), {
        target: { value: JSON.stringify(value) },
      })
    },
  }
}

const BAR: MarkPlot = { marks: [{ mark: 'bar', encoding: { y: 'score' } }] }

it('opens on the declared plot', () => {
  setup(BAR)
  expect(screen.getByTestId('mark-plot-json')).toHaveValue(
    JSON.stringify(BAR, null, 2),
  )
  expect(screen.getByText('No changes')).toBeTruthy()
})

it('writes only the settings that moved', () => {
  const { type, apply, applyDisplaySettings, handleClose } = setup(BAR)
  type({ ...BAR, facet: 'HP' })
  fireEvent.click(apply())
  expect(applyDisplaySettings).toHaveBeenCalledWith({ facet: 'HP' })
  expect(handleClose).toHaveBeenCalled()
})

it('clears a setting a null names', () => {
  const { type, apply, applyDisplaySettings } = setup({ ...BAR, facet: 'HP' })
  type({ facet: null })
  fireEvent.click(apply())
  expect(applyDisplaySettings).toHaveBeenCalledWith({ facet: null })
})

it('writes nothing while the text does not parse', () => {
  const { apply, applyDisplaySettings } = setup(BAR)
  fireEvent.change(screen.getByTestId('mark-plot-json'), {
    target: { value: '{ not json' },
  })
  expect(apply()).toBeDisabled()
  fireEvent.click(apply())
  expect(applyDisplaySettings).not.toHaveBeenCalled()
})

it('writes nothing for a setting the box does not hold, and says which', () => {
  const { type, apply } = setup(BAR)
  type({ ...BAR, height: 100 })
  expect(apply()).toBeDisabled()
  expect(screen.getByText(/height is not a setting/)).toBeTruthy()
})

it('writes nothing for a mark type the schema refuses', () => {
  const { type, apply } = setup(BAR)
  type({ marks: [{ mark: 'wiggle' }] })
  expect(apply()).toBeDisabled()
  expect(screen.getByText(/a mark is one of/)).toBeTruthy()
})

// ADR-133: a load refuses none of these, so an editor that did would be
// stricter than both the loader and the display, and the user who hit it would
// have no way forward.
it('applies a plot whose rules report an error, having said so', () => {
  const { type, apply, applyDisplaySettings } = setup(BAR)
  type({ marks: [{ mark: 'bar' }] })
  expect(screen.getByTestId('mark-plot-problems').textContent).toMatch(
    /names no y field to plot/,
  )
  expect(apply()).not.toBeDisabled()
  fireEvent.click(apply())
  expect(applyDisplaySettings).toHaveBeenCalledWith({
    marks: [{ mark: 'bar' }],
  })
})

it('counts the problems beside what applying writes', () => {
  const { type } = setup(BAR)
  type({ marks: [{ mark: 'span', encoding: { y: 'score' } }] })
  expect(screen.getByText('Sets marks. 1 problem')).toBeTruthy()
})

it('seeds over the declared plot without losing the rest', () => {
  const model: PlotJsonDialogModel = {
    markPlot: BAR,
    markPlotExamples: [],
    liftMarkPlot: plot => liftMarkPlot(schema, plot, BAR),
    applyDisplaySettings: jest.fn(),
  }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PlotJsonDialog
        model={model}
        seed={{ rows: 'source' }}
        handleClose={jest.fn()}
      />
    </ThemeProvider>,
  )
  expect(screen.getByTestId('mark-plot-json')).toHaveValue(
    JSON.stringify({ ...BAR, rows: 'source' }, null, 2),
  )
})
