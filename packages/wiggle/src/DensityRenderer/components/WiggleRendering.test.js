import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import WiggleRendering from './WiggleRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const renderer = new ShallowRenderer()
  renderer.render(
    <WiggleRendering
      width={500}
      height={500}
      highResolutionScaling={1}
      region={{ refName: 'chr1', start: 1, end: 3 }}
      bpPerPx={3}
    />,
  )
  const result = renderer.getRenderOutput()

  expect(result).toMatchSnapshot()
})
