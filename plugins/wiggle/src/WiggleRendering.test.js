import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import WiggleRendering from './WiggleRendering'

// these tests do very little, let's try to expand them at some point
test('one', async () => {
  const { container, getByTestId } = render(
    <WiggleRendering
      width={500}
      height={500}
      features={new Map()}
      highResolutionScaling={1}
      regions={[{ refName: 'chr1', start: 1, end: 3 }]}
      bpPerPx={3}
      config={{ type: 'DummyRenderer' }}
    />,
  )
  const test = await getByTestId('wiggle-rendering-test')
  expect(fireEvent.click(test)).toBeTruthy()
  expect(container.firstChild).toMatchSnapshot()
})
