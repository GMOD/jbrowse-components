import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getParent } from '@jbrowse/mobx-state-tree'
import {
  breakpointSplitViewId,
  launchBreakpointSplitView,
} from '@jbrowse/sv-core'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

function defaultOnChordClick(feature: Feature, chordTrack: object) {
  const session = getSession(chordTrack)
  try {
    session.setSelection(feature)
    const view = getContainingView(chordTrack) as CircularViewModel
    const parentView = getParent<{
      type: string
      spreadsheetView: { id: string }
    }>(view)
    const assemblyName = view.assemblyNames[0]!
    launchBreakpointSplitView({
      session,
      feature,
      assemblyName,
      // in the SV inspector, reuse the same view the sheet's own row menu opens
      // so a chord click and a row click don't stack two of them. Other
      // circular views get a fresh view per click
      stableViewId:
        parentView.type === 'SvInspectorView'
          ? breakpointSplitViewId(parentView.spreadsheetView.id, assemblyName)
          : undefined,
    })
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
      ReactComponent: lazy(() => import('./components/SvInspectorView.tsx')),
    })
  })
}
