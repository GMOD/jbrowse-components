import { fireEvent, render } from '@testing-library/react'

import BooleanEditor from './BooleanEditor.tsx'

test('reflects a plain boolean slot and writes the flip', () => {
  const slot = {
    name: 'testBoolean',
    value: false,
    description: 'test',
    set: jest.fn(),
  }
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  const box = getByRole('checkbox') as HTMLInputElement
  expect(box.checked).toBe(false)
  fireEvent.click(box)
  expect(slot.set).toHaveBeenCalledWith(true)
})

// A `maybeBoolean` slot is undefined when unset, and the checkbox has no state
// for that — it draws unchecked rather than going uncontrolled.
test('an unset maybeBoolean slot shows unchecked', () => {
  const slot = {
    name: 'showSoftClipping',
    value: undefined,
    description: 'test',
    set: jest.fn(),
  }
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
})
