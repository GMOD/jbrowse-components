import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

import type PluginManager from '@jbrowse/core/PluginManager'

class SelectionLengthPlugin extends Plugin {
  name = 'SelectionLengthPlugin'

  install(pluginManager: PluginManager) {
    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      stateModel.extend(self => {
        const superLaunchMenuItems = self.rubberBandLaunchMenuItems
        return {
          views: {
            rubberBandLaunchMenuItems() {
              return [
                ...superLaunchMenuItems(),
                {
                  label: 'Selection length',
                  onClick: () => {
                    const bp = self
                      .getSelectedRegions(self.leftOffset, self.rightOffset)
                      .reduce((sum, r) => sum + r.end - r.start, 0)
                    getSession(self).notify(
                      `${bp.toLocaleString()} bp selected`,
                      'info',
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
}

export default function InlinePlugin() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      plugins={[SelectionLengthPlugin]}
      tracks={[
        {
          trackId: 'volvox_gff3',
          name: 'Volvox genes',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      ]}
      view={{ loc: 'ctgA:1105..1221' }}
    />
  )
}
