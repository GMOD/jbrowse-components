import { fireEvent, render } from '@testing-library/react'

import NumberTextField from './NumberTextField.tsx'

test('whitespace is an invalid number, not zero', () => {
  const onValueChange = jest.fn()
  const { getByRole, getByText } = render(
    <NumberTextField onValueChange={onValueChange} />,
  )
  fireEvent.change(getByRole('textbox'), { target: { value: '  ' } })
  expect(onValueChange).toHaveBeenLastCalledWith(undefined, '  ')
  expect(getByText('Must be a valid number')).toBeTruthy()
})

test('a number with surrounding spaces parses', () => {
  const onValueChange = jest.fn()
  const { getByRole } = render(
    <NumberTextField onValueChange={onValueChange} min={0} />,
  )
  fireEvent.change(getByRole('textbox'), { target: { value: ' 5 ' } })
  expect(onValueChange).toHaveBeenLastCalledWith(5, ' 5 ')
})
