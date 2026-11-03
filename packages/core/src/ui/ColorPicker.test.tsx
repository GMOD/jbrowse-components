import { cleanup, fireEvent, render } from '@testing-library/react'

import ColorPicker from './ColorPicker.tsx'

afterEach(cleanup)

function renderPicker() {
  const onChange = jest.fn()
  const result = render(<ColorPicker color="red" onChange={onChange} />)
  const input = result.container.querySelector('input[type="text"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('no text input')
  }
  return { onChange, input }
}

test('typing an unparseable partial value does not commit black', () => {
  const { onChange, input } = renderPicker()
  fireEvent.change(input, { target: { value: '#f' } })
  expect(input.value).toBe('#f')
  expect(onChange).not.toHaveBeenCalled()
})

test('typing a parseable value commits it as rgb', () => {
  const { onChange, input } = renderPicker()
  fireEvent.change(input, { target: { value: '#ff0000' } })
  expect(onChange).toHaveBeenCalledWith('rgb(255, 0, 0)')
})
