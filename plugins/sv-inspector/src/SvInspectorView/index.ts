import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { getContainingView, getSession } from '@jbrowse/core/util'
import ReactComponent from './components/SvInspectorView'
import stateModelFactory from './models/SvInspectorView'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type BreakpointSplitViewType from '@jbrowse/plugin-breakpoint-split-view/src/BreakpointSplitView/BreakpointSplitView'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

function defaultOnChordClick(
  feature: Feature,
  chordTrack: IAnyStateTreeNode,
  pluginManager: PluginManager,
) {
  const session = getSession(chordTrack)
  session.setSelection(feature)
  const view = getContainingView(chordTrack) as CircularViewModel
  const viewType = pluginManager.getViewType(
    'BreakpointSplitView',
  ) as BreakpointSplitViewType
  const viewSnapshot = viewType.snapshotFromBreakendFeature(feature, view)

  // try to center the offsetPx
  viewSnapshot.views[0]!.offsetPx -= view.width / 2 + 100
  viewSnapshot.views[1]!.offsetPx -= view.width / 2 + 100

  session.addView('BreakpointSplitView', viewSnapshot)
}

export default function SvInspectorViewF(pluginManager: PluginManager) {
  pluginManager.jexl.addFunction('defaultOnChordClick', defaultOnChordClick)

  pluginManager.addViewType(() => {
    const stateModel = stateModelFactory(pluginManager)
    return new ViewType({
      name: 'SvInspectorView',
      displayName: 'SV inspector',
      stateModel,
      ReactComponent,
    })
  })
}
