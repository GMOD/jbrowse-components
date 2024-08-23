import { vi, test, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

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
