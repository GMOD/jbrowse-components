import DotplotHighlight from './DotplotHighlight.tsx'
import Highlight from './Highlight.tsx'
import OverviewHighlight from './OverviewHighlight.tsx'

import type { IExtendedDotplotView, IExtendedLGV } from '../../model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    (rest, { model }) => [
      ...rest,
      <Highlight key="highlight_grid_bookmark" model={model as IExtendedLGV} />,
    ],
  )
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-OverviewScalebarComponent',
    (rest, { model }) => [
      ...rest,
      <OverviewHighlight
        key="overview_highlight_grid_bookmark"
        model={model as IExtendedLGV}
      />,
    ],
  )
  pluginManager.addToExtensionPoint(
    'DotplotView-OverlaySVGComponent',
    (rest, { model }) => [
      ...rest,
      <DotplotHighlight
        key="dotplot_highlight_grid_bookmark"
        model={model as IExtendedDotplotView}
      />,
    ],
  )
}
