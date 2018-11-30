import PluginManager from '../../PluginManager'

import configSchemaFactory from './configSchema'

test('has a viewType attr', () => {
  const configSchema = configSchemaFactory(new PluginManager())
  const config = configSchema.create({
    type: 'AlignmentsTrack',

    name: 'Zonker Track',
  })
  expect(config.viewType).toEqual('LinearGenomeView')
})
