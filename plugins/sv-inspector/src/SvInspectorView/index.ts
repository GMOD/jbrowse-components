import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getContainingView, getSession } from '@jbrowse/core/util'

// locals
import ReactComponent from './components/SvInspectorView'
import stateModelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

// types
import type { Feature } from '@jbrowse/core/util'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'
import type { IAnyStateTreeNode } from 'mobx-state-tree'
import { singleLevelSnapshotFromBreakendFeature } from '@jbrowse/sv-core'

function defaultOnChordClick(feature: Feature, chordTrack: IAnyStateTreeNode) {
  const session = getSession(chordTrack)
  session.setSelection(feature)
  const view = getContainingView(chordTrack) as CircularViewModel
  const { coverage, snap } = singleLevelSnapshotFromBreakendFeature({
    feature,
    view,
  })

  // try to center the offsetPx
  snap.views[0]!.offsetPx -= view.width / 2 + 100
  snap.views[1]!.offsetPx -= view.width / 2 + 100

  const newViewId = `${chordTrack.id}_spawned`
  const viewInStack = session.views.find(v => v.id === newViewId)

  // new view
  if (!viewInStack) {
    session.addView('BreakpointSplitView', {
      ...viewSnapshot,
      id: newViewId,
    })
  }

  // re-nav existing view
  else {
    // @ts-expect-error
    const { views } = viewInStack
    for (let i = 0; i < views.length; i++) {
      views[i].setDisplayedRegions(viewSnapshot.views[i]?.displayedRegions)
      views[i].scrollTo(viewSnapshot.views[0]?.offsetPx)
      views[i].zoom(viewSnapshot.views[0]?.bpPerPx)
    }
  }
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
