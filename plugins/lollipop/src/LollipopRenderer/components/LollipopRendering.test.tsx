import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

import ConfigSchema from '../configSchema'
import Rendering from './LollipopRendering'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

// these tests do very little, let's try to expand them at some point
test('no features', () => {
  const { container } = render(
    <Rendering
      width={500}
      height={500}
      regions={[{ refName: 'zonk', start: 0, end: 300 }]}
      config={ConfigSchema.create(undefined, { pluginManager })}
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
      config={ConfigSchema.create(undefined, { pluginManager })}
      bpPerPx={3}
    />,
  )

  expect(container).toMatchSnapshot()
})
