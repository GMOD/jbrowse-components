import Plugin from '@jbrowse/core/Plugin'
import { addViewMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { copyText } from '@jbrowse/core/util/copyText'
import { JBrowse } from '@jbrowse/react-app2'

import type PluginManager from '@jbrowse/core/PluginManager'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    trackId: 'volvox_cram',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.cram',
  },
]

class CopyAsBedPlugin extends Plugin {
  name = 'CopyAsBedPlugin'

  install(pluginManager: PluginManager) {
    addViewMenuItems(pluginManager, 'LinearGenomeView', {
      menu: 'rubberBandMenuItems',
      items: self => {
        const bed = self
          .getSelectedRegions(self.leftOffset, self.rightOffset)
          .map(r => `${r.refName}\t${r.start}\t${r.end}`)
          .join('\n')
        return {
          label: 'Copy as BED',
          onClick: () => {
            void copyText(self, bed, 'BED')
          },
        }
      },
    })
  }
}

// #region usePlugin
export default function InlinePlugin() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      plugins={[CopyAsBedPlugin]}
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
