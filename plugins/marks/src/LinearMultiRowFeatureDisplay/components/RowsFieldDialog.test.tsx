import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import RowsFieldDialog from './RowsFieldDialog.tsx'

import type { AttributeScan } from '@jbrowse/display-kit/attributeVerdict'

const SCAN: AttributeScan = [
  {
    field: 'repClass',
    values: ['DNA', 'LINE', 'SINE'],
    missing: false,
    overflow: false,
  },
  { field: 'name', values: [], missing: false, overflow: true },
]

test('the attribute box lists what the features in view carry, with row counts, and Apply writes the rows field', async () => {
  const setRowsField = jest.fn()
  const handleClose = jest.fn()
  const { getByTestId, getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <RowsFieldDialog
        model={{
          id: 'display1',
          rowsField: '',
          setRowsField,
          scanGroupByCandidates: jest.fn(async () => SCAN),
        }}
        handleClose={handleClose}
      />
    </ThemeProvider>,
  )
  fireEvent.mouseDown(getByTestId('rows-by-attribute'))
  const option = await screen.findByRole('option', { name: /repClass/ })
  expect(option.textContent).toBe('repClass3 rows')
  expect(
    (await screen.findByRole('option', { name: /name/ })).textContent,
  ).toBe('name40+ rows')
  fireEvent.click(option)
  fireEvent.click(getByText('Apply'))
  expect(setRowsField).toHaveBeenCalledWith('repClass')
  expect(handleClose).toHaveBeenCalled()
})
