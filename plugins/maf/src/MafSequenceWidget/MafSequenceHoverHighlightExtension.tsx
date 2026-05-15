import React from 'react'

import MafSequenceHoverHighlight from './MafSequenceHoverHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export default function MafSequenceHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (
      rest: React.ReactNode[] | undefined,
      { model }: { model: LinearGenomeViewModel },
    ) => {
      return [
        ...(rest ?? []),
        <MafSequenceHoverHighlight
          key="maf-sequence-hover-highlight"
          model={model}
        />,
      ]
    },
  )
}
