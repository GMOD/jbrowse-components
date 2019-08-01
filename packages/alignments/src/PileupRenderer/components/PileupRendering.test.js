import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'
import React from 'react'
import { render } from 'react-testing-library'
import PileupRendering from './PileupRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const { container } = render(
    <PileupRendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 1, end: 3 }}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
