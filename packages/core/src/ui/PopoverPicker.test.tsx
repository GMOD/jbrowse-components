import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import PopoverPicker from './PopoverPicker.tsx'
import { createJBrowseTheme } from './theme.ts'

test('the swatch is a button named by its label, which opens the picker', () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PopoverPicker
        label="Color of chr1:1-100"
        color="red"
        onChange={() => {}}
      />
    </ThemeProvider>,
  )
  const swatch = screen.getByRole('button', { name: 'Color of chr1:1-100' })
  expect(screen.queryByRole('presentation')).toBeNull()
  fireEvent.click(swatch)
  expect(screen.getByRole('presentation')).toBeTruthy()
})
