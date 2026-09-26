import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { configSchemaFactory } from '../configSchema.ts'
import { liftMarkPlot } from '../markPlot.ts'
import MarkPlotDialog from './MarkPlotDialog.tsx'

import type { MarkPlot } from '../markPlot.ts'
import type { MarkPlotDialogModel } from './MarkPlotDialog.tsx'

const schema = configSchemaFactory()

function setup(markPlot: MarkPlot = {}) {
  const applyDisplaySettings = jest.fn()
  const openPlotJsonDialog = jest.fn()
  const handleClose = jest.fn()
  const model: MarkPlotDialogModel = {
    markPlot,
    plotFields: { numeric: ['score'], categorical: ['strand'] },
    plotScanLocus: 'ctgA:1..20,000',
    liftMarkPlot: plot => liftMarkPlot(schema, plot, markPlot),
    applyDisplaySettings,
    openPlotJsonDialog,
  }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <MarkPlotDialog model={model} handleClose={handleClose} />
    </ThemeProvider>,
  )
  return {
    applyDisplaySettings,
    openPlotJsonDialog,
    handleClose,
    apply: () => screen.getByRole('button', { name: 'Apply' }),
    channel: (name: string) => screen.getByTestId(`channel-${name}`),
  }
}

const BAR: MarkPlot = { marks: [{ mark: 'bar', encoding: { y: 'score' } }] }

it('lists the marks in paint order with what each reads', () => {
  setup({
    marks: [
      { mark: 'bar', encoding: { y: 'score' } },
      { mark: 'span', encoding: { color: { value: 'red' } } },
    ],
  })
  expect(screen.getByTestId('mark-row-0').textContent).toContain(
    'bar · y score',
  )
  expect(screen.getByTestId('mark-row-1').textContent).toContain(
    'span · color red',
  )
})

it('offers only the channels the selected mark type reads', () => {
  setup({ marks: [{ mark: 'span' }] })
  expect(screen.queryByTestId('channel-y')).toBeNull()
  expect(screen.getByTestId('channel-color')).toBeTruthy()
})

it('writes a channel through, inferring the scale a field implies', () => {
  const { channel, apply, applyDisplaySettings } = setup(BAR)
  fireEvent.change(channel('color'), { target: { value: 'strand' } })
  fireEvent.click(apply())
  expect(applyDisplaySettings).toHaveBeenCalledWith({
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'strand', scale: 'categorical' },
        },
      },
    ],
  })
})

it('adds a mark and says at once what it still needs', () => {
  setup({ marks: [] })
  fireEvent.click(screen.getByText('Add mark'))
  expect(screen.getByTestId('mark-row-0')).toBeTruthy()
  expect(screen.getByTestId('mark-row-0-error')).toBeTruthy()
})

it('removes and reorders, since the list order is the paint order', () => {
  const { apply, applyDisplaySettings } = setup({
    marks: [{ mark: 'bar', encoding: { y: 'a' } }, { mark: 'span' }],
  })
  fireEvent.click(screen.getByLabelText('move mark 2 up'))
  fireEvent.click(apply())
  expect(applyDisplaySettings.mock.calls[0]![0].marks[0]).toEqual({
    mark: 'span',
  })
})

// The form never silently drops a slot: a channel the new type stopped
// reading stays, named, with the rule that says what it costs.
it('keeps a channel a type change stopped reading, and clears it on request', () => {
  const { apply, applyDisplaySettings } = setup(BAR)
  fireEvent.change(screen.getByTestId('mark-type'), {
    target: { value: 'span' },
  })
  expect(screen.getByText(/does not read these/)).toBeTruthy()
  fireEvent.click(screen.getByText('Clear'))
  fireEvent.click(apply())
  expect(applyDisplaySettings).toHaveBeenCalledWith({
    marks: [{ mark: 'span', encoding: {} }],
  })
})

// A key's labels say more than a field picker and its scale row can, so the
// control shows the declaration rather than offering to rewrite it without the
// members it never displayed.
it('holds a declaration the picker cannot round-trip read-only', () => {
  setup({
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'score', scale: 'categorical', labels: ['a'] },
        },
      },
    ],
  })
  expect(screen.getByTestId('channel-color')).toBeDisabled()
  expect(screen.getByText(/edit as JSON/)).toBeTruthy()
})

it('hands the draft to the JSON box unapplied', () => {
  const { channel, openPlotJsonDialog, applyDisplaySettings } = setup(BAR)
  fireEvent.change(channel('row'), { target: { value: 'hp' } })
  fireEvent.click(screen.getByText('Edit as JSON...'))
  expect(openPlotJsonDialog).toHaveBeenCalledWith({
    marks: [{ mark: 'bar', encoding: { y: 'score', row: 'hp' } }],
  })
  expect(applyDisplaySettings).not.toHaveBeenCalled()
})

// The controls take free text, so a shape name the enumeration lacks reaches
// the lift. The form says so and holds Apply rather than throwing.
it('reports a value the schema refuses instead of crashing', () => {
  const { channel, apply, applyDisplaySettings } = setup({
    marks: [{ mark: 'point', encoding: { y: 'score' } }],
  })
  fireEvent.change(channel('shape'), { target: { value: 'rhombus' } })
  expect(screen.getByTestId('mark-plot-error')).toBeTruthy()
  expect(apply()).toBeDisabled()
  fireEvent.click(apply())
  expect(applyDisplaySettings).not.toHaveBeenCalled()
})

describe('a scale beside its field', () => {
  const RAMP: MarkPlot = {
    marks: [
      {
        mark: 'bar',
        encoding: { y: 'score', color: { field: 'score', scale: 'linear' } },
      },
    ],
  }

  it('shows no scale row for a channel holding a constant', () => {
    setup({ marks: [{ mark: 'bar', encoding: { color: { value: 'red' } } }] })
    expect(screen.queryByTestId('scale-color')).toBeNull()
  })

  it('offers every colour scale the schema declares, and shape only its own', () => {
    setup(RAMP)
    const options = [...screen.getByTestId('scale-color').children].map(
      o => (o as HTMLOptionElement).value,
    )
    expect(options).toEqual(['categorical', 'linear', 'log', 'threshold'])
  })

  it('names a ramp its stops and pins its ends', () => {
    const { channel, apply, applyDisplaySettings } = setup(RAMP)
    fireEvent.change(screen.getByTestId('scheme-color'), {
      target: { value: 'magma' },
    })
    fireEvent.change(screen.getByTestId('domainMin-color'), {
      target: { value: '0' },
    })
    fireEvent.click(apply())
    expect(
      applyDisplaySettings.mock.calls[0]![0].marks[0].encoding.color,
    ).toEqual({
      field: 'score',
      scale: 'linear',
      scheme: 'magma',
      domainMin: 0,
    })
    expect(channel('color')).toBeTruthy()
  })

  // A ramp's stops and ends say nothing under a categorical scale, and the rule
  // list would report them, so the kind change drops what it cannot paint.
  it('drops the ramp members when the kind stops painting them', () => {
    const { apply, applyDisplaySettings } = setup({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'score', scale: 'linear', scheme: 'viridis' },
          },
        },
      ],
    })
    fireEvent.change(screen.getByTestId('scale-color'), {
      target: { value: 'categorical' },
    })
    expect(screen.queryByTestId('scheme-color')).toBeNull()
    fireEvent.click(apply())
    expect(
      applyDisplaySettings.mock.calls[0]![0].marks[0].encoding.color,
    ).toEqual({ field: 'score', scale: 'categorical' })
  })

  // The members the row does not show keep the picker above read-only, so the
  // form still cannot drop a palette it never displayed.
  it('leaves a channel naming a range to the JSON box', () => {
    setup({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'x', scale: 'categorical', range: ['red'] },
          },
        },
      ],
    })
    expect(screen.getByTestId('channel-color')).toBeDisabled()
    expect(screen.queryByTestId('scale-color')).toBeNull()
  })
})
