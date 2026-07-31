import { addExtensionElement } from '@jbrowse/core/ui'

import SequenceFeatureHoverHighlight from './SequenceFeatureHoverHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SequenceFeatureHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  addExtensionElement(
    pluginManager,
    'LinearGenomeView-TracksContainerComponent',
    SequenceFeatureHoverHighlight,
  )
}
