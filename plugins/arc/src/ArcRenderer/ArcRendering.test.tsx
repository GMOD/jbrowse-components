import { ConfigurationSchema } from '@jbrowse/core/configuration'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import Rendering from './ArcRendering'
afterEach(() => {
  cleanup()
})

test('no features', () => {
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      config={ConfigurationSchema('Test', {}).create()}
      regions={[
        { refName: 'zonk', start: 0, end: 300, assemblyName: 'volvox' },
      ]}
      bpPerPx={3}
      features={new Map()}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={ConfigurationSchema('Test', {}).create()}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      regions={[
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              refName: 't1',
              uniqueId: 'one',
              score: 10,
              start: 1,
              end: 3,
            }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})

test('one semicircle', () => {
  const { container } = render(
    <Rendering
      exportSVG={false}
      height={400}
      config={ConfigurationSchema('Test', {
        displayMode: { type: 'string', defaultValue: 'semicircles' },
      }).create()}
      displayModel={{ selectedFeatureId: 'none' }}
      onFeatureClick={() => {}}
      regions={[
        { refName: 'zonk', start: 0, end: 1000, assemblyName: 'volvox' },
      ]}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({
              refName: 't1',
              uniqueId: 'one',
              score: 10,
              start: 1,
              end: 3,
            }),
          ],
        ])
      }
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})
