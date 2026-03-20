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
