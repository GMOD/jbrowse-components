import React from 'react'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import WiggleRendering from './WiggleRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const { container } = render(
    <WiggleRendering
      width={500}
      height={500}
      features={new Map()}
      regions={[{ refName: 'chr1', start: 1, end: 3, assemblyName: 'volvox' }]}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
