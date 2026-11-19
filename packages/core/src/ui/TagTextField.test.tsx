import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import TagTextField from './TagTextField.tsx'
import { createJBrowseTheme } from './theme.ts'

test('emits the tag once it is a valid 2-char tag, undefined otherwise', () => {
  const onValueChange = jest.fn()
  const { getByRole } = render(
    <TagTextField onValueChange={onValueChange} inputTestId="tag-input" />,
  )
  const input = getByRole('textbox')

  fireEvent.change(input, { target: { value: 'H' } })
  expect(onValueChange).toHaveBeenLastCalledWith(undefined)

  fireEvent.change(input, { target: { value: 'HP' } })
  expect(onValueChange).toHaveBeenLastCalledWith('HP')

  // leading digit is invalid
  fireEvent.change(input, { target: { value: '1P' } })
  expect(onValueChange).toHaveBeenLastCalledWith(undefined)
})

test('the picked chip is filled with the accent color', () => {
  const theme = createJBrowseTheme({}, undefined, 'default', 'dark')
  const { getByText } = render(
    <ThemeProvider theme={theme}>
      <TagTextField
        onValueChange={() => {}}
        defaultValue="HP"
        quickPicks={[{ tag: 'HP' }]}
      />
    </ThemeProvider>,
  )
  const chip = getByText('HP').parentElement
  expect(chip && getComputedStyle(chip).backgroundColor).toBe(
    theme.palette.accent,
  )
})

test('caps input at two characters', () => {
  const { getByRole } = render(<TagTextField onValueChange={() => {}} />)
  expect(getByRole('textbox').getAttribute('maxlength')).toBe('2')
})

test('quick-pick chip fills the field and emits the tag', () => {
  const onValueChange = jest.fn()
  const { getByRole, getByText } = render(
    <TagTextField
      onValueChange={onValueChange}
      quickPicks={[{ tag: 'HP', label: 'Haplotype' }]}
    />,
  )
  fireEvent.click(getByText('HP — Haplotype'))
  expect(onValueChange).toHaveBeenLastCalledWith('HP')
  expect((getByRole('textbox') as HTMLInputElement).value).toBe('HP')
})
