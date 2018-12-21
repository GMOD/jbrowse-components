import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import Rendering from './SvgFeatureRendering'
import PrecomputedLayout from '../../../util/layouts/PrecomputedLayout'
import { MapOperator } from 'rxjs/internal/operators/map';

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const renderer = new ShallowRenderer()
  renderer.render(
    <Rendering
      width={500}
      height={500}
      region={{ assembly: 'toaster', refName: 'zonk', start: 0, end: 300 }}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      config={{}}
      bpPerPx={3}
    />,
  )
  const result = renderer.getRenderOutput()

  expect(result).toMatchSnapshot()
})

test('a couple of features', () => {
  const renderer = new ShallowRenderer()
  renderer.render(
    <Rendering
      width={500}
      height={500}
      region={{ assembly: 'toaster', refName: 'zonk', start: 0, end: 1000 }}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      features={new Map()}
      config={{}}
      bpPerPx={3}
    />,
  )
  const result = renderer.getRenderOutput()

  expect(result).toMatchSnapshot()
})
