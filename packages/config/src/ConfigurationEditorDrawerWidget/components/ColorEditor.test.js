import React from 'react'
import { render, fireEvent } from 'react-testing-library'

import { ColorPicker } from './ColorEditor'

describe('ColorPicker widget', () => {
  it('can change value via the text field', () => {
    const myfn = jest.fn()
    const { getByValue } = render(<ColorPicker value="green" onChange={myfn} />)
    const ret = getByValue('green')
    fireEvent.change(ret, { target: { value: 'red' } })
    expect(myfn).toHaveBeenCalledWith('red')
  })
})
