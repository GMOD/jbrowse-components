import SequenceFeatureHoverHighlight from './SequenceFeatureHoverHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SequenceFeatureHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    (rest, { model }) => [
      ...rest,
      <SequenceFeatureHoverHighlight
        key="feature-sequence-hover-highlight"
        model={model}
      />,
    ],
  )
}
