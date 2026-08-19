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

// An unset `maybeNumber` is a promotable slot's inherit sentinel. The empty box
// is right; saying nothing about what the track therefore draws at was not.
test('an unset promotable slot states what unset resolves to', () => {
  const slot = {
    name: 'featureHeight',
    value: undefined,
    description: 'test',
    promotedBase: 7,
    set: jest.fn(),
  }
  const { container, getByLabelText } = render(<NumberEditor slot={slot} />)
  expect(getByLabelText('featureHeight').getAttribute('placeholder')).toBe('7')
  // MUI hides a placeholder behind an unshrunk label, so the field would show
  // nothing without the shrink — which `ConfigurationTextField` used to drop by
  // replacing the caller's whole `slotProps` bag rather than merging it
  expect(container.querySelector('label')?.className).toMatch(
    /MuiInputLabel-shrink/,
  )
})

test('a customized promotable slot shows its own value, not the base', () => {
  const slot = {
    name: 'featureHeight',
    value: 11,
    description: 'test',
    promotedBase: 7,
    set: jest.fn(),
  }
  const { getByDisplayValue } = render(<NumberEditor slot={slot} />)
  expect(getByDisplayValue('11').getAttribute('placeholder')).toBeNull()
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
