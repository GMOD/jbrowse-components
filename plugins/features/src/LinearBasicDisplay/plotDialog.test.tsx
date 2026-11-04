import '@testing-library/jest-dom'

import PlotDialog from '@jbrowse/display-kit/PlotDialog'
import { fireEvent, render, screen } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

// The "Edit plot..." box over a real display: a seed or an example lands over
// the plot as a settings bag would, so the text keeps what it leaves alone, and
// the text is the whole plot, so a line deleted from it resets.
function open(seed?: Record<string, unknown>) {
  const { display } = createTestEnvironment().createDisplay()
  display.setGenesFilter('only')
  render(<PlotDialog model={display} seed={seed} handleClose={() => {}} />)
  const field = screen.getByTestId('plot-json') as HTMLTextAreaElement
  return {
    display,
    field,
    type: (value: unknown) => {
      fireEvent.change(field, { target: { value: JSON.stringify(value) } })
    },
    apply: () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    },
  }
}

// a filter list is written whole, as Vega-Lite's is
it('a seed writes the filter list whole', () => {
  const { field, display, apply } = open({
    filter: ['jexl:feature.score > 100'],
  })
  expect(JSON.parse(field.value)).toEqual({
    filter: ['jexl:feature.score > 100'],
  })
  apply()
  expect(display.genesFilter).toBeUndefined()
  expect(display.configuredFilters()).toEqual(['jexl:feature.score > 100'])
})

it('a member deleted from the text resets', () => {
  const { display, type, apply } = open()
  type({ filter: ['jexl:feature.score > 100'] })
  expect(screen.getByText('Sets filter')).toBeInTheDocument()
  apply()
  expect(display.genesFilter).toBeUndefined()
  expect(display.configuredFilters()).toEqual(['jexl:feature.score > 100'])
})

it('a setting deleted from the text resets', () => {
  const { display, type, apply } = open()
  type({})
  expect(screen.getByText('Resets filter')).toBeInTheDocument()
  apply()
  expect(display.plot).toEqual({})
})
