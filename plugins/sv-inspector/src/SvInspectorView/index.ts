import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { navToMultiLevelBreak } from '@jbrowse/sv-core'
import { type IAnyStateTreeNode, getParent } from '@jbrowse/mobx-state-tree'

import stateModelFactory from './model'

import type { SvInspectorViewModel } from './model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

function defaultOnChordClick(feature: Feature, chordTrack: IAnyStateTreeNode) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    const session = getSession(chordTrack)
    try {
      session.setSelection(feature)
      const view = getContainingView(chordTrack) as CircularViewModel
      const parentView = getParent<any>(view) as SvInspectorViewModel
      const stableViewId = `${parentView.id}_spawned`
      await navToMultiLevelBreak({
        assemblyName: view.assemblyNames[0]!,
        session,
        stableViewId,
        feature,
      })
    } catch (e) {
      console.error(e)
      session.notifyError(`${e}`, e)
    }
  })()
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
