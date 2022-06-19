import React from 'react'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'
import PluginManager from '../PluginManager'
import { stateModelFactory } from '.'
import BaseFeatureDetails from './BaseFeatureDetail'

test('open up a widget', () => {
  console.warn = jest.fn()
  const pluginManager = new PluginManager([])

  const Session = types.model({
    pluginManager: types.optional(types.frozen(), {}),
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create({
    widget: { type: 'BaseFeatureWidget' },
  })
  const { container, getByText } = render(
    <BaseFeatureDetails model={model.widget} />,
  )
  model.widget.setFeatureData({
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    refName: 'ctgA',
  })
  expect(container.firstChild).toMatchSnapshot()
  expect(getByText('ctgA:3..102 (+)')).toBeTruthy()
})
