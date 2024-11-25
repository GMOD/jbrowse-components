import React from 'react'

// locals
import Highlight from './Highlight'
import OverviewHighlight from './OverviewHighlight'
import type { IExtendedLGV } from '../../model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (
      rest: React.ReactNode[] | undefined,
      { model }: { model: IExtendedLGV },
    ) => {
      return [
        ...(rest || []),
        <Highlight key="highlight_grid_bookmark" model={model} />,
      ]
    },
  )
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-OverviewScalebarComponent',
    // @ts-expect-error
    (
      rest: React.ReactNode[] | undefined,
      { model, overview }: { model: IExtendedLGV; overview: Base1DViewModel },
    ) => {
      return [
        ...(rest || []),
        <OverviewHighlight
          key="overview_highlight_grid_bookmark"
          model={model}
          overview={overview}
        />,
      ]
    },
  )
}
