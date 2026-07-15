import { fireEvent, render } from '@testing-library/react'

import TagTextField from './TagTextField.tsx'

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
