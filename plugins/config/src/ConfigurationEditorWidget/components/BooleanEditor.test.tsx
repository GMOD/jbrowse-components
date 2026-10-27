import { fireEvent, render, within } from '@testing-library/react'

import BooleanEditor from './BooleanEditor.tsx'

test('reflects a plain boolean slot and writes the flip', () => {
  const slot = {
    name: 'testBoolean',
    type: 'boolean',
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

test('an unset maybeBoolean slot shows default, not off, and can go back to it', () => {
  const slot = {
    name: 'showSoftClipping',
    type: 'maybeBoolean',
    value: true as boolean | undefined,
    description: 'test',
    set: jest.fn(),
  }
  const unset = render(<BooleanEditor slot={{ ...slot, value: undefined }} />)
  expect(unset.getByRole('combobox').textContent).toBe('default')
  unset.unmount()
  const { getByRole } = render(<BooleanEditor slot={slot} />)
  expect(getByRole('combobox').textContent).toBe('on')
  fireEvent.mouseDown(getByRole('combobox'))
  fireEvent.click(within(getByRole('listbox')).getByText('default'))
  expect(slot.set).toHaveBeenCalledWith(undefined)
})
