import MafSequenceHoverHighlight from './MafSequenceHoverHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafSequenceHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    (rest, { model }) => [
      ...rest,
      <MafSequenceHoverHighlight
        key="maf-sequence-hover-highlight"
        model={model}
      />,
    ],
  )
}
