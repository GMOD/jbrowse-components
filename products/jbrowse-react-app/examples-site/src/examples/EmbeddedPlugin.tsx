import Plugin from '@jbrowse/core/Plugin'
import { JBrowse } from '@jbrowse/react-app2'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    adapter: { type: 'CramAdapter', uri: `${base}/volvox-sorted.cram` },
  },
]

class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          const newStateModel = view.stateModel.extend(self => {
            const superItems = self.rubberBandMenuItems
            return {
              views: {
                rubberBandMenuItems() {
                  return [
                    ...superItems(),
                    {
                      label: 'Console log selected region',
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        console.log(
                          JSON.stringify(
                            self.getSelectedRegions(leftOffset, rightOffset),
                          ),
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

export default function EmbeddedPlugin() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      plugins={[HighlightRegionPlugin]}
      views={[
        {
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            loc: 'ctgA:1..50000',
            tracks: ['volvox_cram'],
          },
        },
      ]}
    />
  )
}
