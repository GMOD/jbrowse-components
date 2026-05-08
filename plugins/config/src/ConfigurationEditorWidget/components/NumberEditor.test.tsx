import { fireEvent, render } from '@testing-library/react'

import NumberEditor from './NumberEditor.tsx'

test('calls slot.set with parsed number on change', () => {
  const slot = {
    name: 'testNumber',
    value: 42,
    description: 'test',
    set: jest.fn(),
  }
  const { getByDisplayValue } = render(<NumberEditor slot={slot} />)
  fireEvent.change(getByDisplayValue('42'), { target: { value: '100' } })
  expect(slot.set).toHaveBeenCalledWith(100)
})

test('does not commit NaN input (leaves slot untouched)', () => {
  // regression: previously cleared the field reset the slot to default,
  // which surprised users who were just retyping a value
  const slot = {
    name: 'testNumber',
    value: 42,
    description: 'test',
    set: jest.fn(),
  }
  const { getByDisplayValue } = render(<NumberEditor slot={slot} />)
  fireEvent.change(getByDisplayValue('42'), { target: { value: 'abc' } })
  expect(slot.set).not.toHaveBeenCalled()
})

test('does not call slot.set on initial render', () => {
  const slot = {
    name: 'testNumber',
    value: 42,
    description: 'test',
    set: jest.fn(),
  }
  render(<NumberEditor slot={slot} />)
  expect(slot.set).not.toHaveBeenCalled()
})
