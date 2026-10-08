import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
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

export default function InlinePlugin() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    plugins: [HighlightRegionPlugin],
    tracks: [
      {
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
    ],
    location: 'ctgA:1105..1221',
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
