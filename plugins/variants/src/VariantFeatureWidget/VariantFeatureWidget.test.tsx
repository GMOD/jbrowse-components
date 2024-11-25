import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'

// locals
import VariantFeatureDetails from './VariantFeatureWidget'
import { stateModelFactory } from './stateModelFactory'

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

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(container).toMatchSnapshot()
})
