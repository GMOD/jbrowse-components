import PluginManager from '@jbrowse/core/PluginManager'
import FeaturesPlugin from '@jbrowse/plugin-features'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import VariantsPlugin from '../index.ts'

test('the variant track declares the widget this plugin registers', () => {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new FeaturesPlugin(),
    new VariantsPlugin(),
  ])
  pluginManager.createPluggableElements()
  const declared = pluginManager.getTrackType('VariantTrack').featureWidget
  expect(declared).toEqual({
    type: 'VariantFeatureWidget',
    id: 'variantFeature',
  })
  expect(pluginManager.widgetTypes.has(declared!.type)).toBe(true)
})
