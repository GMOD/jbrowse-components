import React from 'react'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { stateModelFactory } from '.'
import VariantFeatureDetails from './VariantFeatureWidget'

test('renders with just the required model elements', () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        // @ts-expect-error
        type: 'VariantFeatureWidget',
      },
    },
    { pluginManager },
  )
  model.widget.setFeatureData({
    refName: 'ctgA',
    start: 176,
    end: 177,
    name: 'rs123',
    REF: 'A',
    ALT: ['<TRA>'],
    QUAL: 10.4,
    INFO: {
      MQ: 5,
    },
  })

  const { container } = render(<VariantFeatureDetails model={model.widget} />)
  expect(container.firstChild).toMatchSnapshot()
})
