import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { type IAnyStateTreeNode, getParent } from '@jbrowse/mobx-state-tree'

import stateModelFactory from './model'

import type { SvInspectorViewModel } from './model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

const ChordClickDialog = lazy(() => import('./ChordClickDialog'))

function defaultOnChordClick(feature: Feature, chordTrack: IAnyStateTreeNode) {
  const session = getSession(chordTrack)
  try {
    session.setSelection(feature)
    const view = getContainingView(chordTrack) as CircularViewModel
    const parentView = getParent<any>(view) as SvInspectorViewModel
    const stableViewId = `${parentView.id}_spawned`
    const assemblyName = view.assemblyNames[0]!
    session.queueDialog(handleClose => [
      ChordClickDialog,
      {
        handleClose,
        session,
        feature,
        stableViewId,
        assemblyName,
      },
    ])
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
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
      ReactComponent: lazy(() => import('./components/SvInspectorView')),
    })
  })
}
