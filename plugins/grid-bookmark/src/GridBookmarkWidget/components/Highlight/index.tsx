import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import Highlight from './Highlight'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (
      rest: React.ReactNode[] = [],
      { model }: { model: LinearGenomeViewModel },
    ) => {
      return [
        ...rest,
        <Highlight key={`highlight_grid_bookmark`} model={model} />,
      ]
    },
  )
}
