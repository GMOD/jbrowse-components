import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

// locals
import Highlight from './Highlight'
import OverviewHighlight from './OverviewHighlight'
import { IExtendedLGV } from '../../model'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (rest: React.ReactNode[], { model }: { model: IExtendedLGV }) => {
      return [
        ...rest,
        <Highlight key="highlight_grid_bookmark" model={model} />,
      ]
    },
  )
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-OverviewScalebarComponent',
    // @ts-expect-error
    (
      rest: React.ReactNode[],
      { model, overview }: { model: IExtendedLGV; overview: Base1DViewModel },
    ) => {
      return [
        ...rest,
        <OverviewHighlight
          key="overview_highlight_grid_bookmark"
          model={model}
          overview={overview}
        />,
      ]
    },
  )
}
