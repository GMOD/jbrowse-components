import React from 'react'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'

// locals
import { stateModelFactory } from '.'
import PluginManager from '../PluginManager'
import { ConfigurationSchema } from '../configuration'
import BaseFeatureDetails from './BaseFeatureDetail'
import { createJBrowseTheme } from '../ui'

test('open up a widget', async () => {
  const pluginManager = new PluginManager([])

  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
      },
    },
    { pluginManager },
  )
  const { container, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  model.widget.setFeatureData({
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    refName: 'ctgA',
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(container).toMatchSnapshot()
})
