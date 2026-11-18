import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import ColorByAttributeDialog from './ColorByAttributeDialog.tsx'

import type { AttributeScan } from './attributeVerdict.ts'

const SCAN: AttributeScan = [
  {
    field: 'biotype',
    values: ['lncRNA', 'protein_coding'],
    missing: false,
    overflow: false,
  },
]

test('the attribute box lists what the features in view carry, with color counts', async () => {
  const colorByField = jest.fn()
  const handleClose = jest.fn()
  const { getByTestId, getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ColorByAttributeDialog
        model={{
          id: 'display1',
          colorByAttribute: '',
          colorField: undefined,
          colorByField,
          setShowLegend: jest.fn(),
          openPlotDialog: jest.fn(),
          scanGroupByCandidates: jest.fn(async () => SCAN),
        }}
        handleClose={handleClose}
      />
    </ThemeProvider>,
  )

  fireEvent.mouseDown(getByTestId('color-by-attribute'))
  const option = await screen.findByRole('option', { name: /biotype/ })
  expect(option.textContent).toBe('biotype2 colors')

  fireEvent.click(option)
  fireEvent.click(getByText('Apply'))
  expect(colorByField).toHaveBeenCalledWith('biotype')
  expect(handleClose).toHaveBeenCalled()
})

// the dialog promises a key, so Apply brings back one the user had hidden, as
// the preset rows of the same menu do
test('Apply shows the legend before it colors', () => {
  const calls: string[] = []
  const { getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ColorByAttributeDialog
        model={{
          id: 'display1',
          colorByAttribute: 'biotype',
          colorField: undefined,
          colorByField: field => calls.push(`color ${field}`),
          setShowLegend: show => calls.push(`legend ${show}`),
          openPlotDialog: jest.fn(),
          scanGroupByCandidates: jest.fn(async () => SCAN),
        }}
        handleClose={jest.fn()}
      />
    </ThemeProvider>,
  )
  fireEvent.click(getByText('Apply'))
  expect(calls).toEqual(['legend true', 'color biotype'])
})

// a parked field fills the box while nothing paints, so Edit plot seeds it
test('Edit plot over the parked field opens on that field', () => {
  const openPlotDialog = jest.fn()
  const { getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ColorByAttributeDialog
        model={{
          id: 'display1',
          colorByAttribute: 'biotype',
          colorField: undefined,
          colorByField: jest.fn(),
          setShowLegend: jest.fn(),
          openPlotDialog,
          scanGroupByCandidates: jest.fn(async () => SCAN),
        }}
        handleClose={jest.fn()}
      />
    </ThemeProvider>,
  )
  fireEvent.click(getByText('Edit plot...'))
  expect(openPlotDialog).toHaveBeenCalledWith({
    encoding: { color: { field: 'biotype' } },
  })
})
