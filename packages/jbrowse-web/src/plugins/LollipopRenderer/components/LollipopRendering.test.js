import React from 'react'
import TestRenderer from 'react-test-renderer'
import Rendering from './LollipopRendering'
import SimpleFeature from '../../../util/simpleFeature'
import ConfigSchema from '../configSchema'
import { PrecomputedFloatingLayout, FloatingLayout } from '../Layout';

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const renderer = TestRenderer.create(
    <Rendering
      width={500}
      height={500}
      region={{ assemblyName: 'toaster', refName: 'zonk', start: 0, end: 300 }}
      layout={new PrecomputedFloatingLayout({ pairs: [], totalHeight: 20 })}
      config={{}}
      bpPerPx={3}
    />,
  )
  const result = renderer.toJSON()

  expect(result).toMatchSnapshot()
})

test('one feature', () => {
  const renderer = TestRenderer.create(
    <Rendering
      width={500}
      height={500}
      region={{ assemblyName: 'toaster', refName: 'zonk', start: 0, end: 1000 }}
      layout={new FloatingLayout({ width: 100 })}
      features={
        new Map([['one', new SimpleFeature({ id: 'one', start: 1, end: 3 })]])
      }
      config={ConfigSchema.create({})}
      bpPerPx={3}
    />,
  )
  const result = renderer.toJSON()

  expect(result).toMatchSnapshot()
})
