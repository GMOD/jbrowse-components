import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import React from 'react'
import { render } from '@testing-library/react'
import Rendering from './ArcRendering'

test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 300 }]}
      blockKey={1}
      config={{}}
      bpPerPx={3}
      displayModel={{}}
      features={new Map()}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})

test('one feature', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 1000 }]}
      blockKey={1}
      features={
        new Map([
          [
            'one',
            new SimpleFeature({ uniqueId: 'one', score: 10, start: 1, end: 3 }),
          ],
        ])
      }
      config={{ type: 'DummyRenderer' }}
      bpPerPx={3}
      displayModel={{}}
    />,
  )

  expect(container.firstChild).toMatchSnapshot()
})
