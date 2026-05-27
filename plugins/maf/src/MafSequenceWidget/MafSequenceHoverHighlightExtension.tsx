import MafSequenceHoverHighlight from './MafSequenceHoverHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export default function MafSequenceHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    (rest, props) => {
      const { model } = props as { model: LinearGenomeViewModel }
      return [
        ...rest,
        <MafSequenceHoverHighlight
          key="maf-sequence-hover-highlight"
          model={model}
        />,
      ]
    },
  )
}
