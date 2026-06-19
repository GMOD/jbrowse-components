import { useState } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import { types } from '@jbrowse/mobx-state-tree'
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz' },
      index: { location: { uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi' } },
    },
  },
]

class MyPlugin extends Plugin {
  name = 'MyPlugin'
  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          view.stateModel = types.compose(
            view.stateModel,
            types.model().actions(() => ({
              zoomTo: () => {},
              scrollTo: () => {},
            })),
          )
        }
        return pluggableElement
      },
    )
  }
  configure() {}
}

export default function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      plugins: [MyPlugin],
      location: 'ctgA:1105..1221',
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}
