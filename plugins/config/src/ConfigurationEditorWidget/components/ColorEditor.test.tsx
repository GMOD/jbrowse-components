import { fireEvent, render } from '@testing-library/react'

import ColorEditor from './ColorEditor.tsx'

test('can change value via the text field', () => {
  const set = jest.fn()
  const slot = { name: '', value: 'green', description: '', set }
  const { getByDisplayValue } = render(<ColorEditor slot={slot} />)
  fireEvent.change(getByDisplayValue('green'), { target: { value: 'red' } })
  expect(set).toHaveBeenCalledWith('red')
})

// The slot refuses a string that is not a color, so a half-typed one cannot
// be written on every keystroke; it stays in the field until it parses.
test('holds text that is not yet a color as a draft, and writes it once it is', () => {
  const set = jest.fn()
  const slot = { name: 'color', value: 'green', description: 'the fill', set }
  const { getByDisplayValue, getByText } = render(<ColorEditor slot={slot} />)
  const field = getByDisplayValue('green')
  fireEvent.change(field, { target: { value: '#ff' } })
  expect(set).not.toHaveBeenCalled()
  expect(getByDisplayValue('#ff')).toBe(field)
  expect(getByText('"#ff" is not a color')).toBeTruthy()
  fireEvent.change(field, { target: { value: '#ff0000' } })
  expect(set).toHaveBeenCalledWith('#ff0000')
})

test('leaving the field drops an unparsed draft', () => {
  const set = jest.fn()
  const slot = { name: 'color', value: 'green', description: '', set }
  const { getByDisplayValue } = render(<ColorEditor slot={slot} />)
  const field = getByDisplayValue('green')
  fireEvent.change(field, { target: { value: 'biotype' } })
  fireEvent.blur(field)
  expect(set).not.toHaveBeenCalled()
  expect(getByDisplayValue('green')).toBe(field)
})

test('writes a jexl: callback only where the slot declares a contextVariable', () => {
  const callback = "jexl:feature.strand == 1 ? 'red' : 'blue'"
  const set = jest.fn()
  const plain = { name: 'color', value: 'green', description: '', set }
  const { getByDisplayValue, unmount } = render(<ColorEditor slot={plain} />)
  fireEvent.change(getByDisplayValue('green'), { target: { value: callback } })
  expect(set).not.toHaveBeenCalled()
  unmount()

  const withCallback = { ...plain, contextVariable: ['feature'] }
  const second = render(<ColorEditor slot={withCallback} />)
  fireEvent.change(second.getByDisplayValue('green'), {
    target: { value: callback },
  })
  expect(set).toHaveBeenCalledWith(callback)
})
