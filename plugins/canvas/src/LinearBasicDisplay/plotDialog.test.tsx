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

it("a seed keeps the filter's other tests in the text", () => {
  const { field, display, apply } = open({
    filter: ['jexl:feature.score > 100'],
  })
  expect(JSON.parse(field.value)).toEqual({
    filter: { expressions: ['jexl:feature.score > 100'], genes: 'only' },
  })
  apply()
  expect(display.genesFilter).toBe('only')
  expect(display.configuredFilters()).toEqual(['jexl:feature.score > 100'])
})

it('a member deleted from the text resets', () => {
  const { display, type, apply } = open()
  type({ filter: { expressions: ['jexl:feature.score > 100'] } })
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
