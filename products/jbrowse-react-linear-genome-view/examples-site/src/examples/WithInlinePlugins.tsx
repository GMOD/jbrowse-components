import Plugin from '@jbrowse/core/Plugin'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          const newStateModel = view.stateModel.extend(self => {
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
          })
          view.stateModel = newStateModel
        }
        return pluggableElement
      },
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
  return <JBrowseLinearGenomeView viewState={state} />
}
