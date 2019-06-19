import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'
import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import PileupRendering from './PileupRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const renderer = new ShallowRenderer()
  renderer.render(
    <PileupRendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 1, end: 3 }}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      bpPerPx={3}
    />,
  )
  const result = renderer.getRenderOutput()

  expect(result).toMatchSnapshot()
})
