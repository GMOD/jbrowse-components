import { addExtensionElement } from '@jbrowse/core/ui'

import DotplotHighlightChipOverlay from './DotplotHighlightChipOverlay.tsx'
import DotplotHighlights from './DotplotHighlights.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function installDotplotHighlights(pluginManager: PluginManager) {
  addExtensionElement(
    pluginManager,
    'DotplotView-OverlaySVGComponent',
    DotplotHighlights,
  )
  addExtensionElement(
    pluginManager,
    'DotplotView-OverlayHTMLComponent',
    DotplotHighlightChipOverlay,
  )
}
