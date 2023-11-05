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
        { refName: 'zonk', start: 0, end: 300, assemblyName: 'volvox' },
      ]}
      bpPerPx={3}
      features={new Map()}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
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
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({ uniqueId: 'one', score: 10, start: 1, end: 3 }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
