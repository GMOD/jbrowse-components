import React from 'react'
import { render } from '@testing-library/react'
import CoverageRendering from './CoverageRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const { container } = render(
    <CoverageRendering
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
