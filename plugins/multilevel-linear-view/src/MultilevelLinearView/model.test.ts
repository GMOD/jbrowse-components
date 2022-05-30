import PluginManager from '@jbrowse/core/PluginManager'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import LinearGenomeMultilevelView from '../LinearGenomeMultilevelView'
import stateModelFactory from './model'

test('creation', () => {
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])
  pluginManager.addViewType(() =>
    pluginManager.jbrequire(LinearGenomeMultilevelView),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const model = stateModelFactory(pluginManager)
  model.create({
    id: 'MiDMyyWpxp',
    type: 'MultilevelLinearView',
    displayName: 'MLLV Default',
    linkViews: true,
    views: [
      {
        id: 'MoMeeVade',
        type: 'LinearGenomeMultilevelView',
        displayName: 'Overview',
        bpPerPx: 100000,
        isOverview: true,
        displayedRegions: [
          {
            refName: '3',
            start: 0,
            end: 186700647,
            assemblyName: 'hg38',
          },
        ],
        tracks: [],
      },
      {
        id: 'MoMeeVasdfade',
        type: 'LinearGenomeMultilevelView',
        displayName: 'Region',
        bpPerPx: 100,
        displayedRegions: [
          {
            refName: '3',
            start: 0,
            end: 186700647,
            assemblyName: 'hg38',
          },
        ],
        tracks: [],
      },
      {
        id: 'MoasdfMeeVade',
        type: 'LinearGenomeMultilevelView',
        displayName: 'Details',
        bpPerPx: 1,
        isAnchor: true,
        displayedRegions: [
          {
            refName: '3',
            start: 85313457,
            end: 86313456,
            assemblyName: 'hg38',
          },
        ],
        tracks: [],
      },
    ],
  })
})
