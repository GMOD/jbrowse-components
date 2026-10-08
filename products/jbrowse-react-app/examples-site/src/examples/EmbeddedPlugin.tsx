import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { JBrowse } from '@jbrowse/react-app2'

import type PluginManager from '@jbrowse/core/PluginManager'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    uri: `${base}/volvox-sorted.cram`,
  },
]

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
                  label: 'Highlight selected region',
                  onClick: () => {
                    const { leftOffset, rightOffset } = self
                    const session = getSession(self)
                    for (const region of self.getSelectedRegions(
                      leftOffset,
                      rightOffset,
                    )) {
                      session.addHighlight(region)
                    }
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
