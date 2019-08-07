import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import React from 'react'
import { render } from '@testing-library/react'
import ConfigSchema from '../configSchema'
import { FloatingLayout, PrecomputedFloatingLayout } from '../Layout'
import Rendering from './LollipopRendering'

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      region={{ refName: 'zonk', start: 0, end: 300 }}
      layout={new PrecomputedFloatingLayout({ pairs: [], totalHeight: 20 })}
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
      region={{
        refName: 'zonk',
        start: 0,
        end: 1000,
      }}
      layout={new FloatingLayout({ width: 100 })}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({ id: 'one', score: 10, start: 1, end: 3 }),
          ],
        ])
      }
      config={ConfigSchema.create({})}
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
