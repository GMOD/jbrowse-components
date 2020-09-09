import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'
import React from 'react'
import { render } from '@testing-library/react'
import HicRendering from './HicRendering'

// these tests do very little, let's try to expand them at some point
test('one', () => {
  const { container } = render(
    <HicRendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 1, end: 3 }]}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      bpPerPx={3}
      config={{ type: 'DummyRenderer' }}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
