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
          colorByField,
          openChannelSpecDialog: jest.fn(),
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
