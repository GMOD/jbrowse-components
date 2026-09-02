import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

import type PluginManager from '@jbrowse/core/PluginManager'

class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      stateModel.extend(self => {
        const superRubberBandMenuItems = self.rubberBandMenuItems
        return {
          views: {
            rubberBandMenuItems() {
              return [
                ...superRubberBandMenuItems(),
                {
                  label: 'Console log selected region',
                  onClick: () => {
                    const { leftOffset, rightOffset } = self
                    console.log(
                      self.getSelectedRegions(leftOffset, rightOffset),
                    )
                  },
                },
              ]
            },
          },
        }
      }),
    )
  }

  configure() {}
}

export default function WithInlinePlugins() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    plugins: [HighlightRegionPlugin],
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
    location: 'ctgA:1105..1221',
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
