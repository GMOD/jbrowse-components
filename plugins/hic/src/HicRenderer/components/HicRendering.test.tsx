import React from 'react'
import { render } from '@testing-library/react'
import HicRendering from './HicRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const { container } = render(
    <HicRendering
      width={500}
      height={500}
      regions={[{ assemblyName: 'volvox', refName: 'zonk', start: 1, end: 3 }]}
      bpPerPx={3}
      blockKey="test"
    />,
  )

  expect(container).toMatchSnapshot()
})
