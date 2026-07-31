import { addExtensionElement } from '@jbrowse/core/ui'

import DotplotHighlight from './DotplotHighlight.tsx'
import Highlight from './Highlight.tsx'
import LGVHighlightSVG from './LGVHighlightSVG.tsx'
import OverviewHighlight from './OverviewHighlight.tsx'
import ScalebarHighlight from './ScalebarHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AddHighlightModelF(pluginManager: PluginManager) {
  addExtensionElement(
    pluginManager,
    'LinearGenomeView-TracksContainerComponent',
    Highlight,
  )
  addExtensionElement(
    pluginManager,
    'LinearGenomeView-ScalebarHighlightComponent',
    ScalebarHighlight,
  )
  addExtensionElement(
    pluginManager,
    'LinearGenomeView-OverviewScalebarComponent',
    OverviewHighlight,
  )
  addExtensionElement(
    pluginManager,
    'DotplotView-OverlaySVGComponent',
    DotplotHighlight,
  )
  addExtensionElement(
    pluginManager,
    'LinearGenomeView-HighlightSVGComponent',
    LGVHighlightSVG,
  )
}
