import PluginManager from '@jbrowse/core/PluginManager'

import AlignmentsPlugin from '../index.ts'

test('the alignments track declares the widget this plugin registers', () => {
  const pluginManager = new PluginManager([new AlignmentsPlugin()])
  pluginManager.createPluggableElements()
  const declared = pluginManager.getTrackType('AlignmentsTrack').featureWidget
  expect(declared).toEqual({
    type: 'AlignmentsFeatureWidget',
    id: 'alignmentFeature',
  })
  expect(pluginManager.widgetTypes.has(declared!.type)).toBe(true)
})
