import { addExtensionElement } from '@jbrowse/core/ui'

import MafSequenceHoverHighlight from './MafSequenceHoverHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafSequenceHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  addExtensionElement(
    pluginManager,
    'LinearGenomeView-TracksContainerComponent',
    MafSequenceHoverHighlight,
  )
}
