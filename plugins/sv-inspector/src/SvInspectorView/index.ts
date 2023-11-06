import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import ReactComponent from './components/SvInspectorView'
import stateModelFactory from './models/SvInspectorView'
import { Feature, getContainingView, getSession } from '@jbrowse/core/util'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import BreakpointSplitViewType from '@jbrowse/plugin-breakpoint-split-view/src/BreakpointSplitView/BreakpointSplitView'
import { CircularViewModel } from '@jbrowse/plugin-circular-view'

async function defaultOnChordClick(
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
  const [assemblyName] = view.assemblyNames
  if (!assemblyName) {
    throw new Error('error trying to understand what assembly to use')
  }
  const viewSnapshot = await viewType.snapshotFromBreakendFeature({
    feature,
    assemblyName,
    session,
  })

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
