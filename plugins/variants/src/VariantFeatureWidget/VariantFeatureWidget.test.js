import React from 'react'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { stateModelFactory } from '.'

import VariantFeatureDetails from './VariantFeatureWidget'

describe('VariantTrack widget', () => {
  it('renders with just the required model elements', () => {
    console.warn = jest.fn()
    const pluginManager = new PluginManager([])
    const Session = types.model({
      rpcManager: types.optional(types.frozen(), {}),
      pluginManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      widget: stateModelFactory(pluginManager),
    })
    const model = Session.create({
      widget: { type: 'VariantFeatureWidget' },
    })
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
})
