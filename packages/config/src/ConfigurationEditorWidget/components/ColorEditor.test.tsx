import React from 'react'
import { render, fireEvent } from '@testing-library/react'

import { ColorSlot } from './ColorEditor'

describe('ColorPicker widget', () => {
  it('can change value via the text field', () => {
    const myfn = jest.fn()
    const { getByDisplayValue } = render(
      <ColorSlot value="green" onChange={myfn} />,
    )
    const ret = getByDisplayValue('green')
    fireEvent.change(ret, { target: { value: 'red' } })
    expect(myfn).toHaveBeenCalledWith('red')
  })
})
