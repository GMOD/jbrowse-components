import React from 'react'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { stateModelFactory } from './stateModelFactory'
import VariantFeatureDetails from './VariantFeatureWidget'

test('renders with just the required model elements', () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    configuration: ConfigurationSchema('test', {}),
    rpcManager: types.optional(types.frozen(), {}),
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
    ALT: ['<TRA>'],
    INFO: {
      MQ: 5,
    },
    QUAL: 10.4,
    REF: 'A',
    end: 177,
    name: 'rs123',
    refName: 'ctgA',
    start: 176,
  })

  const { container } = render(<VariantFeatureDetails model={model.widget} />)
  expect(container).toMatchSnapshot()
})
