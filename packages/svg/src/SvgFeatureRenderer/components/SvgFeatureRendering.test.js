import GranularRectLayout from '@gmod/jbrowse-core/util/layouts/GranularRectLayout'
import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import React from 'react'
import { render } from 'react-testing-library'
import SvgRendererConfigSchema from '../configSchema'
import Rendering from './SvgFeatureRendering'
// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 0, end: 300 }}
      layout={new PrecomputedLayout({ rectangles: {}, totalHeight: 20 })}
      config={{}}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 0, end: 1000 }}
      layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
      features={
        new Map([['one', new SimpleFeature({ id: 'one', start: 1, end: 3 })]])
      }
      config={SvgRendererConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
