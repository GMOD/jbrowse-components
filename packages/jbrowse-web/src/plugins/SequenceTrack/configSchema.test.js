import PluginManager from '../../PluginManager'

import configSchemaFactory from './configSchema'

import SequenceRendererPlugin from '../DivSequenceRenderer'

test('has a viewType attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([SequenceRendererPlugin]).configure(),
  )
  const config = configSchema.create({
    type: 'SequenceTrack',
    name: 'Sequence Track',
  })
  expect(config.viewType).toEqual('LinearGenomeView')
})
