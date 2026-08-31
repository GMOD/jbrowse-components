import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { JBrowse } from '@jbrowse/react-app2'

import type PluginManager from '@jbrowse/core/PluginManager'

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
    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      stateModel.extend(self => {
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
      }),
    )
  }

  configure() {}
}

// #region usePlugin
export default function EmbeddedPlugin() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      // the class itself, not a definition to fetch — an embedded app has no
      // config.json to list plugins in
      plugins={[HighlightRegionPlugin]}
      views={[
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1..50000',
          tracks: ['volvox_cram'],
        },
      ]}
    />
  )
}
// #endregion
