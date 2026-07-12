import DotplotHighlight from './DotplotHighlight.tsx'
import Highlight from './Highlight.tsx'
import LGVHighlightSVG from './LGVHighlightSVG.tsx'
import OverviewHighlight from './OverviewHighlight.tsx'
import ScalebarHighlight from './ScalebarHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    (rest, { model }) => [
      ...rest,
      <Highlight key="highlight_grid_bookmark" model={model} />,
    ],
  )
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-ScalebarHighlightComponent',
    (rest, { model }) => [
      ...rest,
      <ScalebarHighlight
        key="scalebar_highlight_grid_bookmark"
        model={model}
      />,
    ],
  )
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-OverviewScalebarComponent',
    (rest, { model }) => [
      ...rest,
      <OverviewHighlight
        key="overview_highlight_grid_bookmark"
        model={model}
      />,
    ],
  )
  pluginManager.addToExtensionPoint(
    'DotplotView-OverlaySVGComponent',
    (rest, { model }) => [
      ...rest,
      <DotplotHighlight key="dotplot_highlight_grid_bookmark" model={model} />,
    ],
  )
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-HighlightSVGComponent',
    (rest, { model, height }) => [
      ...rest,
      <LGVHighlightSVG
        key="lgv_highlight_svg_grid_bookmark"
        model={model}
        height={height}
      />,
    ],
  )
}
