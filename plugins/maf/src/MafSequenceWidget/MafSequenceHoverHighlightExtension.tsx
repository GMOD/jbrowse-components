import React from 'react'

import MafSequenceHoverHighlight from './MafSequenceHoverHighlight'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export default function MafSequenceHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    (rest: React.ReactNode[], props: Record<string, unknown>) => {
      const model = props.model as LinearGenomeViewModel
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
