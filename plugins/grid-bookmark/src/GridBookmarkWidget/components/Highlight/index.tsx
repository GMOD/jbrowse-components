import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import Highlight from './Highlight'
import { IExtendedLGV } from '../../model'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (rest: React.ReactNode[] = [], { model }: { model: IExtendedLGV }) => {
      return [
        ...rest,
        <Highlight key={`highlight_grid_bookmark`} model={model} />,
      ]
    },
  )
}
