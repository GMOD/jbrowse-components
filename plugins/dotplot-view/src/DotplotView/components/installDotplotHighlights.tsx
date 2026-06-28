import DotplotHighlightChipOverlay from './DotplotHighlightChipOverlay.tsx'
import DotplotHighlights from './DotplotHighlights.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function installDotplotHighlights(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'DotplotView-OverlaySVGComponent',
    (rest, { model }) => [
      ...rest,
      <DotplotHighlights key="dotplot_native_highlights" model={model} />,
    ],
  )
  pluginManager.addToExtensionPoint(
    /** #extensionPoint DotplotView-OverlayHTMLComponent | sync | Add an HTML overlay component to the dotplot view */
    'DotplotView-OverlayHTMLComponent',
    () => DotplotHighlightChipOverlay,
  )
}
