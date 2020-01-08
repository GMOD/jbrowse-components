import React from 'react'
import { render } from '@testing-library/react'
import SNPRendering from './SNPRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const { container } = render(
    <SNPRendering
      width={500}
      height={500}
      features={new Map()}
      highResolutionScaling={1}
      region={{ refName: 'chr1', start: 1, end: 3 }}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
