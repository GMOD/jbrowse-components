import PluginManager from '@jbrowse/core/PluginManager'
import AlignmentsPlugin from '@jbrowse/plugin-alignments'
import ComparativeAdaptersPlugin from '@jbrowse/plugin-comparative-adapters'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import LinearComparativeViewPlugin from './index.ts'

test('the synteny track declares the widget this plugin registers', () => {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new AlignmentsPlugin(),
    new ComparativeAdaptersPlugin(),
    new LinearComparativeViewPlugin(),
  ])
  pluginManager.createPluggableElements()
  const declared = pluginManager.getTrackType('SyntenyTrack').featureWidget
  expect(declared).toEqual({
    type: 'SyntenyFeatureWidget',
    id: 'syntenyFeature',
  })
  expect(pluginManager.widgetTypes.has(declared!.type)).toBe(true)
})
