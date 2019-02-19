import PluginManager from '../../PluginManager'

import configSchemaFactory from './configSchema'

import PileupRendererPlugin from '../PileupRenderer'
import SvgFeatureRendererPlugin from '../SvgFeatureRenderer'

test('has a viewType attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([
      new PileupRendererPlugin(),
      new SvgFeatureRendererPlugin(),
    ]).configure(),
  )
  const config = configSchema.create({
    type: 'AlignmentsTrack',

    name: 'Zonker Track',
  })
  expect(config.viewType).toEqual('LinearGenomeView')
})
