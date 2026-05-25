import { fireEvent, render } from '@testing-library/react'

import ColorEditor from './ColorEditor.tsx'

test('can change value via the text field', () => {
  const set = jest.fn()
  const slot = { name: '', value: 'green', description: '', set }
  const { getByDisplayValue } = render(<ColorEditor slot={slot} />)
  fireEvent.change(getByDisplayValue('green'), { target: { value: 'red' } })
  expect(set).toHaveBeenCalledWith('red')
})
