import PluginManager from '../../PluginManager'

import configSchemaFactory from './configSchema'

import PileupRendererPlugin from '../PileupRenderer'

test('has a viewType attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([PileupRendererPlugin]).configure(),
  )
  const config = configSchema.create({
    type: 'AlignmentsTrack',

    name: 'Zonker Track',
  })
  expect(config.viewType).toEqual('LinearGenomeView')
})
