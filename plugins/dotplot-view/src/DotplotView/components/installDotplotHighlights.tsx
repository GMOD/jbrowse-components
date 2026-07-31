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
  pluginManager.addToExtensionPoint(
    /** #extensionPoint DotplotView-OverlayHTMLComponent | sync | Add an HTML overlay component to the dotplot view */
    'DotplotView-OverlayHTMLComponent',
    () => DotplotHighlightChipOverlay,
  )
}
