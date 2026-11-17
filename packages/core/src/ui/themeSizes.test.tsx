import { Button, ButtonGroup, ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { createJBrowseTheme } from './theme.ts'

test('a button in a group is the size of one standing alone', () => {
  const { getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Button>alone</Button>
      <ButtonGroup>
        <Button>grouped</Button>
      </ButtonGroup>
    </ThemeProvider>,
  )
  const sizeOf = (text: string) =>
    [...getByText(text).classList].find(c => c.startsWith('MuiButton-size'))
  expect(sizeOf('grouped')).toBe(sizeOf('alone'))
  expect(sizeOf('alone')).toBe('MuiButton-sizeSmall')
})
