import Plugin from '@jbrowse/core/Plugin'
import { addViewMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { copyText } from '@jbrowse/core/util/copyText'
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

import type PluginManager from '@jbrowse/core/PluginManager'

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

export default function InlinePlugin() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      plugins={[CopyAsBedPlugin]}
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
