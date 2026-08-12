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
    // #region extend
    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      types.compose(
        stateModel,
        types.model().actions(() => ({
          zoomTo: () => {},
          scrollTo: () => {},
        })),
      ),
    )
    // #endregion
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
        type: 'FeatureTrack',
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
    plugins: [MyPlugin],
    // the lock is not only a gesture lock: navTo/moveTo reach the view through
    // the same two actions, so this picks the displayed region but the view
    // opens at its default scale rather than on this window. A view that has to
    // start somewhere specific wants its bpPerPx/offsetPx in a defaultSession
    location: 'ctgA:1105..1221',
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
