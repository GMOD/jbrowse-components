import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import WiggleRendering from './WiggleRendering'
import PrecomputedLayout from '../../../util/layouts/PrecomputedLayout'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const renderer = new ShallowRenderer()
  renderer.render(
    <WiggleRendering
      width={500}
      height={500}
      region={{ assemblyName: 'wookie', refName: 'chr1', start: 1, end: 3 }}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      bpPerPx={3}
    />,
  )
  const result = renderer.getRenderOutput()

  expect(result).toMatchSnapshot()
})
