import { fireEvent, render } from '@testing-library/react'

import { ColorSlot } from './ColorEditor.tsx'

test('can change value via the text field', () => {
  const myfn = jest.fn()
  const { getByDisplayValue } = render(
    <ColorSlot value="green" onChange={myfn} />,
  )
  const ret = getByDisplayValue('green')
  fireEvent.change(ret, { target: { value: 'red' } })
  expect(myfn).toHaveBeenCalledWith('red')
})
