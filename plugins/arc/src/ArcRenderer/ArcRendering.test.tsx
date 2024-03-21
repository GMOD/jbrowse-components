import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import React from 'react'
import { render } from '@testing-library/react'
import Rendering from './ArcRendering'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

test('no features', () => {
  const r = ConfigurationSchema('Test', {}).create()
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      displayModel={{ selectedFeatureId: 'none' }}
      config={r}
      regions={[
        { assemblyName: 'volvox', end: 300, refName: 'zonk', start: 0 },
      ]}
      bpPerPx={3}
      features={new Map()}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one feature', () => {
  const r = ConfigurationSchema('Test', {}).create()
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={r}
      displayModel={{ selectedFeatureId: 'none' }}
      regions={[
        { assemblyName: 'volvox', end: 1000, refName: 'zonk', start: 0 },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({ end: 3, score: 10, start: 1, uniqueId: 'one' }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})
