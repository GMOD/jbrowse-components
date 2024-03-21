import React from 'react'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'

// locals
import { ConfigurationSchema } from '../configuration'
import PluginManager from '../PluginManager'
import { stateModelFactory } from '.'
import BaseFeatureDetails from './BaseFeatureDetail'

test('open up a widget', async () => {
  const pluginManager = new PluginManager([])

  const Session = types.model({
    configuration: ConfigurationSchema('test', {}),
    rpcManager: types.optional(types.frozen(), {}),
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
    <BaseFeatureDetails model={model.widget} />,
  )
  model.widget.setFeatureData({
    end: 102,
    refName: 'ctgA',
    score: 37,
    start: 2,
    strand: 1,
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(container).toMatchSnapshot()
})
