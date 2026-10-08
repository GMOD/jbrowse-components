import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

import type PluginManager from '@jbrowse/core/PluginManager'

class HalfTurnPlugin extends Plugin {
  name = 'HalfTurnPlugin'

  install(pluginManager: PluginManager) {
    extendViewType(pluginManager, 'CircularView', stateModel =>
      stateModel.extend(self => {
        const superMenuItems = self.menuItems
        return {
          views: {
            menuItems() {
              return [
                ...superMenuItems(),
                {
                  label: 'Rotate half a turn',
                  onClick: () => {
                    self.rotate(Math.PI)
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
  return (
    <CircularGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      plugins={[HalfTurnPlugin]}
      tracks={[
        {
          trackId: 'volvox_sv',
          name: 'Volvox duplications',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
        },
      ]}
      view={{ tracks: ['volvox_sv'] }}
    />
  )
}
