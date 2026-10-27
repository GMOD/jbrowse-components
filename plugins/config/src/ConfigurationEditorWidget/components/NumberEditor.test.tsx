import { act, fireEvent, render } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

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

test('integer mode rejects non-integer input', () => {
  const slot = {
    name: 'testInteger',
    value: 42,
    description: 'test',
    set: jest.fn(),
  }
  const { getByDisplayValue } = render(<NumberEditor slot={slot} integer />)
  fireEvent.change(getByDisplayValue('42'), { target: { value: '1.5' } })
  expect(slot.set).not.toHaveBeenCalled()
  fireEvent.change(getByDisplayValue('1.5'), { target: { value: '100' } })
  expect(slot.set).toHaveBeenCalledWith(100)
})

test('a value written elsewhere shows once the field loses focus', () => {
  // an observable slot, since RTL's first rerender remounts the field
  const slot = observable({
    name: 'height',
    value: 42,
    description: 'test',
    set: jest.fn(),
  })
  const { getByLabelText } = render(<NumberEditor slot={slot} />)
  const field = getByLabelText('height') as HTMLInputElement
  act(() => {
    runInAction(() => {
      slot.value = 7
    })
  })
  expect(field.value).toBe('7')
  fireEvent.change(field, { target: { value: '1.' } })
  act(() => {
    runInAction(() => {
      slot.value = 9
    })
  })
  expect(field.value).toBe('1.')
  fireEvent.blur(field)
  expect(field.value).toBe('9')
})

test('a plain number slot gets no placeholder', () => {
  const slot = {
    name: 'coverageHeight',
    value: undefined,
    description: 'test',
    set: jest.fn(),
  }
  const { getByLabelText } = render(<NumberEditor slot={slot} />)
  expect(
    getByLabelText('coverageHeight').getAttribute('placeholder'),
  ).toBeNull()
})
