import { fireEvent, render } from '@testing-library/react'

import NumberEditor from './NumberEditor.tsx'

test('calls slot.set with parsed number on change', () => {
  const slot = {
    name: 'testNumber',
    value: '42',
    description: 'test',
    set: jest.fn(),
    reset: jest.fn(),
  }
  const { getByDisplayValue } = render(<NumberEditor slot={slot} />)
  const input = getByDisplayValue('42')
  fireEvent.change(input, { target: { value: '100' } })
  expect(slot.set).toHaveBeenCalledWith(100)
})

test('calls slot.reset for NaN input', () => {
  const slot = {
    name: 'testNumber',
    value: '42',
    description: 'test',
    set: jest.fn(),
    reset: jest.fn(),
  }
  const { getByDisplayValue } = render(<NumberEditor slot={slot} />)
  const input = getByDisplayValue('42')
  fireEvent.change(input, { target: { value: 'abc' } })
  expect(slot.reset).toHaveBeenCalled()
  expect(slot.set).not.toHaveBeenCalled()
})

test('does not call slot.set on initial render', () => {
  const slot = {
    name: 'testNumber',
    value: '42',
    description: 'test',
    set: jest.fn(),
    reset: jest.fn(),
  }
  render(<NumberEditor slot={slot} />)
  expect(slot.set).not.toHaveBeenCalled()
  expect(slot.reset).not.toHaveBeenCalled()
})
