import { fireEvent, render } from '@testing-library/react'

import JsonEditor from './JsonEditor.tsx'

function getTextarea(container: HTMLElement) {
  const textarea = container.querySelector('textarea')
  if (!textarea) {
    throw new Error('textarea not found')
  }
  return textarea
}

test('calls slot.set with parsed JSON on valid input', () => {
  const slot = {
    name: 'testJson',
    description: 'test',
    value: { key: 'value' },
    set: jest.fn(),
  }
  const { container } = render(<JsonEditor slot={slot} />)
  const textarea = getTextarea(container)
  fireEvent.change(textarea, { target: { value: '{"key":"updated"}' } })
  expect(slot.set).toHaveBeenCalledWith({ key: 'updated' })
})

test('shows error for invalid JSON without calling slot.set', () => {
  const slot = {
    name: 'testJson',
    description: 'test',
    value: { key: 'value' },
    set: jest.fn(),
  }
  const { container } = render(<JsonEditor slot={slot} />)
  const textarea = getTextarea(container)
  fireEvent.change(textarea, { target: { value: '{invalid json' } })
  expect(slot.set).not.toHaveBeenCalled()
  const errorEl = container.querySelector('p')
  expect(errorEl?.textContent).toMatch(/SyntaxError/)
})

test('does not call slot.set on initial render', () => {
  const slot = {
    name: 'testJson',
    description: 'test',
    value: { key: 'value' },
    set: jest.fn(),
  }
  render(<JsonEditor slot={slot} />)
  expect(slot.set).not.toHaveBeenCalled()
})

// An unset `maybeFrozen` slot is the promotable inherit sentinel (alignments
// `colorBy`). `JSON.stringify(undefined)` is the value `undefined`, not a
// string, so the field went uncontrolled until the first keystroke.
test('unset promotable slot shows promotedBase and stays controlled', () => {
  const slot = {
    name: 'colorBy',
    description: 'test',
    value: undefined,
    promotedBase: { type: 'normal' },
    set: jest.fn(),
  }
  const { container } = render(<JsonEditor slot={slot} />)
  const textarea = getTextarea(container)
  expect(textarea.value).toBe(JSON.stringify({ type: 'normal' }, null, 2))
  expect(slot.set).not.toHaveBeenCalled()
})

test('unset slot with no promotedBase renders an empty controlled field', () => {
  const slot = {
    name: 'testJson',
    description: 'test',
    value: undefined,
    set: jest.fn(),
  }
  const { container } = render(<JsonEditor slot={slot} />)
  expect(getTextarea(container).value).toBe('')
})
