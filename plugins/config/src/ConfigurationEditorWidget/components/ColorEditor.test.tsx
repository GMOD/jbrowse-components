import { fireEvent, render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { ColorSlot } from './ColorEditor'

test('can change value via the text field', () => {
  const myfn = vi.fn()
  const { getByDisplayValue } = render(
    <ColorSlot value="green" onChange={myfn} />,
  )
  const ret = getByDisplayValue('green')
  fireEvent.change(ret, { target: { value: 'red' } })
  expect(myfn).toHaveBeenCalledWith('red')
})
