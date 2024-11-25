import React from 'react'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

// locals
import { FloatingLayout, PrecomputedFloatingLayout } from '../Layout'
import ConfigSchema from '../configSchema'
import Rendering from './LollipopRendering'

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 300 }]}
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
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      layout={new FloatingLayout({ width: 100 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              uniqueId: 'one',
              refName: 'r1',
              score: 10,
              start: 1,
              end: 3,
            }),
          ],
        ])
      }
      config={ConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})
