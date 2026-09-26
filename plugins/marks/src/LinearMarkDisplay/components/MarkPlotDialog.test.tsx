import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'

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

it('keeps the selected mark selected when a row above it is removed', () => {
  setup({
    marks: [
      { mark: 'bar', encoding: { y: 'a' } },
      { mark: 'point', encoding: { y: 'a' } },
      { mark: 'span' },
    ],
  })
  fireEvent.click(screen.getByTestId('mark-row-1'))
  fireEvent.click(screen.getByLabelText('remove mark 1'))
  expect(screen.getByTestId('mark-type')).toHaveValue('point')
})

it('takes a fractional zoom bound', () => {
  const { apply, applyDisplaySettings } = setup(BAR)
  fireEvent.change(screen.getByTestId('minBpPerPx'), {
    target: { value: '0' },
  })
  expect(screen.getByTestId('minBpPerPx')).toHaveValue(0)
  fireEvent.change(screen.getByTestId('minBpPerPx'), {
    target: { value: '0.5' },
  })
  fireEvent.click(apply())
  expect(applyDisplaySettings.mock.calls[0]![0].marks[0].minBpPerPx).toBe(0.5)
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
        mark: 'link',
        encoding: { x2: { chrom: 'chrom2', pos: 'start2' } },
      },
    ],
  })
  expect(screen.getByTestId('channel-x2')).toBeDisabled()
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

it('reports a draft the schema refuses instead of crashing', () => {
  const applyDisplaySettings = jest.fn()
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <MarkPlotDialog
        model={{
          markPlot: BAR,
          plotFields: undefined,
          plotScanLocus: undefined,
          liftMarkPlot: () => {
            throw new Error('refused')
          },
          applyDisplaySettings,
          openPlotJsonDialog: jest.fn(),
        }}
        handleClose={jest.fn()}
      />
    </ThemeProvider>,
  )
  expect(screen.getByTestId('mark-plot-error').textContent).toContain('refused')
  const apply = screen.getByRole('button', { name: 'Apply' })
  expect(apply).toBeDisabled()
  fireEvent.click(apply)
  expect(applyDisplaySettings).not.toHaveBeenCalled()
})

describe('a colour or shape typed into its picker', () => {
  const POINT: MarkPlot = {
    marks: [{ mark: 'point', encoding: { y: 'score' } }],
  }

  it('writes a field the scan did not list as a field, and applies', () => {
    const { channel, apply, applyDisplaySettings } = setup(POINT)
    fireEvent.change(channel('color'), { target: { value: 'INFO.DP' } })
    fireEvent.change(channel('shape'), { target: { value: 'score' } })
    expect(screen.queryByTestId('mark-plot-error')).toBeNull()
    fireEvent.click(apply())
    expect(
      applyDisplaySettings.mock.calls[0]![0].marks[0].encoding,
    ).toMatchObject({
      color: { field: 'INFO.DP', scale: 'categorical' },
      shape: { field: 'score', scale: 'categorical' },
    })
  })

  it('keeps the scale row through a constant typed on the way to a field', () => {
    const { channel, apply, applyDisplaySettings } = setup({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'score', scale: 'log', scheme: 'viridis' },
          },
        },
      ],
    })
    const input = channel('color')
    act(() => {
      input.focus()
    })
    for (const typed of ['r', 're', 'red', 'read', 'reads']) {
      fireEvent.change(input, { target: { value: typed } })
    }
    expect(screen.getByTestId('scale-color')).toHaveValue('log')
    fireEvent.click(apply())
    expect(
      applyDisplaySettings.mock.calls[0]![0].marks[0].encoding.color,
    ).toEqual({ field: 'reads', scale: 'log', scheme: 'viridis' })
  })
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
  it("edits a categorical colour's values, colours and key names in place", () => {
    const { apply, applyDisplaySettings } = setup({
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
    expect(screen.getByTestId('channel-color')).not.toBeDisabled()
    expect(screen.getByTestId('range-color')).toHaveValue('red')
    fireEvent.change(screen.getByTestId('domain-color'), {
      target: { value: 'a, b' },
    })
    fireEvent.change(screen.getByTestId('labels-color'), {
      target: { value: 'first,' },
    })
    expect(screen.getByTestId('labels-color')).toHaveValue('first,')
    fireEvent.click(apply())
    expect(applyDisplaySettings).toHaveBeenCalledWith({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: {
              field: 'x',
              scale: 'categorical',
              range: ['red'],
              domain: ['a', 'b'],
              labels: ['first'],
            },
          },
        },
      ],
    })
  })

  it('cuts a threshold at the points typed, with a colour for each interval', () => {
    const { apply, applyDisplaySettings } = setup({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'score', scale: 'threshold' },
          },
        },
      ],
    })
    fireEvent.change(screen.getByTestId('domain-color'), {
      target: { value: '0.5, 0.9' },
    })
    fireEvent.change(screen.getByTestId('range-color'), {
      target: { value: 'blue, grey, red' },
    })
    fireEvent.click(apply())
    expect(applyDisplaySettings).toHaveBeenCalledWith({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: {
              field: 'score',
              scale: 'threshold',
              domain: ['0.5', '0.9'],
              range: ['blue', 'grey', 'red'],
            },
          },
        },
      ],
    })
  })

  it("offers a link's width its own ramps, and no colour's stops", () => {
    const { apply, applyDisplaySettings } = setup({
      marks: [
        { mark: 'link', encoding: { size: { field: 'score', scale: 'log' } } },
      ],
    })
    const options = [...screen.getByTestId('scale-size').children].map(
      o => (o as HTMLOptionElement).value,
    )
    expect(options).toEqual(['linear', 'log'])
    expect(screen.queryByTestId('scheme-size')).toBeNull()
    fireEvent.change(screen.getByTestId('domainMax-size'), {
      target: { value: '100' },
    })
    expect(apply()).toBeEnabled()
    fireEvent.click(apply())
    expect(
      applyDisplaySettings.mock.calls[0]![0].marks[0].encoding.size,
    ).toEqual({ field: 'score', scale: 'log', domainMax: 100 })
  })
})

describe('the plot as a whole', () => {
  it('stacks sections by a field, titles the axis and pins its top', () => {
    const { apply, applyDisplaySettings } = setup(BAR)
    fireEvent.change(screen.getByTestId('facet-field'), {
      target: { value: 'strand' },
    })
    fireEvent.change(screen.getByTestId('axis-title'), {
      target: { value: 'Score' },
    })
    fireEvent.change(screen.getByTestId('axis-domainMax'), {
      target: { value: '10' },
    })
    fireEvent.click(apply())
    expect(applyDisplaySettings).toHaveBeenCalledWith({
      facet: { field: 'strand' },
      scales: { y: { title: 'Score', domainMax: 10 } },
    })
  })

  it('clears a facet when its field is emptied', () => {
    const { apply, applyDisplaySettings } = setup({ ...BAR, facet: 'strand' })
    fireEvent.change(screen.getByTestId('facet-field'), {
      target: { value: '' },
    })
    fireEvent.click(apply())
    expect(applyDisplaySettings).toHaveBeenCalledWith({ facet: null })
  })
})

describe("a mark's steps", () => {
  it('adds a coverage, which fills the y a bar names none of', () => {
    const { apply, applyDisplaySettings } = setup({ marks: [{ mark: 'bar' }] })
    expect(screen.getByTestId('mark-row-0-error')).toBeTruthy()
    fireEvent.change(screen.getByTestId('add-step'), {
      target: { value: '3' },
    })
    expect(screen.getByTestId('mark-step-0').textContent).toContain(
      'coverage as coverage',
    )
    expect(screen.queryByTestId('mark-row-0-error')).toBeNull()
    fireEvent.click(apply())
    expect(applyDisplaySettings).toHaveBeenCalledWith({
      marks: [{ mark: 'bar', transform: [{ type: 'coverage' }] }],
    })
  })

  it("edits a bin's width and an aggregate's summary in place", () => {
    const { apply, applyDisplaySettings } = setup({ marks: [{ mark: 'bar' }] })
    fireEvent.change(screen.getByTestId('add-step'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByTestId('step-bin-step'), {
      target: { value: '5000' },
    })
    fireEvent.change(screen.getByTestId('step-aggregate-op'), {
      target: { value: 'mean' },
    })
    fireEvent.change(screen.getByTestId('step-aggregate-field'), {
      target: { value: 'score' },
    })
    fireEvent.click(apply())
    expect(applyDisplaySettings).toHaveBeenCalledWith({
      marks: [
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 5000 },
            { type: 'aggregate', ops: [{ op: 'mean', field: 'score' }] },
          ],
        },
      ],
    })
  })
})

describe('the mark list', () => {
  it('adds a zoomed-out density, handing the raw marks the closer zooms', () => {
    const { apply, applyDisplaySettings } = setup(BAR)
    fireEvent.click(screen.getByText('Add zoomed-out density'))
    fireEvent.click(apply())
    expect(applyDisplaySettings).toHaveBeenCalledWith({
      marks: [
        { mark: 'bar', encoding: { y: 'score' }, maxBpPerPx: 100 },
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 'auto' },
            { type: 'aggregate', ops: [{ op: 'count' }] },
          ],
          minBpPerPx: 100,
        },
      ],
    })
  })

  it('duplicates a mark right after itself', () => {
    setup(BAR)
    fireEvent.click(screen.getByLabelText('duplicate mark 1'))
    expect(screen.getByTestId('mark-row-1').textContent).toContain(
      'bar · y score',
    )
  })
})
