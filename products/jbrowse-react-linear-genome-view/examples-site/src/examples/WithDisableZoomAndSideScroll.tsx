import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

import type PluginManager from '@jbrowse/core/PluginManager'

class MyPlugin extends Plugin {
  name = 'MyPlugin'
  install(pluginManager: PluginManager) {
    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      types.compose(
        stateModel,
        types.model().actions(() => ({
          zoomTo: () => {},
          scrollTo: () => {},
        })),
      ),
    )
  }
  configure() {}
}

export default function WithDisableZoomAndSideScroll() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
    ],
    plugins: [MyPlugin],
    defaultSession: {
      name: 'disable-zoom-and-side-scroll',
      view: {
        id: 'linearGenomeView',
        type: 'LinearGenomeView',
        hideHeader: true,
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50001 },
        ],
        windowStartBp: 1000,
        windowWidthBp: 8000,
        assembly: 'volvox',
        tracks: ['volvox_gff3'],
      },
    },
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
