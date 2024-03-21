import React from 'react'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

// locals
import ConfigSchema from '../configSchema'
import { FloatingLayout, PrecomputedFloatingLayout } from '../Layout'
import Rendering from './LollipopRendering'

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ end: 300, refName: 'zonk', start: 0 }]}
      layout={new PrecomputedFloatingLayout({ pairs: [], totalHeight: 20 })}
      config={{}}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ end: 1000, refName: 'zonk', start: 0 }]}
      layout={new FloatingLayout({ width: 100 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({ end: 3, score: 10, start: 1, uniqueId: 'one' }),
          ],
        ])
      }
      config={ConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})
