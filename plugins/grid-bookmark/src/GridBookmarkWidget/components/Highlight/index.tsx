import Highlight from './Highlight.tsx'
import OverviewHighlight from './OverviewHighlight.tsx'

import type { IExtendedLGV } from '../../model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    (rest, props) => {
      const { model } = props as { model: IExtendedLGV }
      return [
        ...rest,
        <Highlight key="highlight_grid_bookmark" model={model} />,
      ]
    },
  )
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-OverviewScalebarComponent',
    (rest, props) => {
      const { model, overview } = props as {
        model: IExtendedLGV
        overview: Base1DViewModel
      }
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
