import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getParent } from '@jbrowse/mobx-state-tree'
import {
  breakpointSplitViewId,
  launchBreakpointSplitView,
  makeFindJunctionsNear,
} from '@jbrowse/sv-core'

import stateModelFactory from './model.ts'
import { svChordColor } from './svChordColor.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { FindJunctionsNear } from '@jbrowse/sv-core'

// `chordTrack` is the ChordVariantDisplay: the display is what the
// onChordClick config slot is read from, and it passes itself as `track`
function defaultOnChordClick(
  feature: Feature,
  chordTrack: { adapterConfig?: Record<string, unknown> },
) {
  const session = getSession(chordTrack)
  try {
    const view = getContainingView(chordTrack)
    const assemblyName = view.assemblyNames?.[0]
    if (!assemblyName) {
      return
    }
    session.setSelection(feature)
    // the containing view's parent is the SvInspectorView when the circle is
    // the inspector's, and session.views otherwise
    const parentView = getParent<{
      type?: string
      spreadsheetView?: {
        id: string
        importedTrackId?: string
        spreadsheet?: { findJunctionsNear: () => FindJunctionsNear }
      }
    }>(view)
    const inspector =
      parentView.type === 'SvInspectorView'
        ? parentView.spreadsheetView
        : undefined
    launchBreakpointSplitView({
      session,
      feature,
      assemblyName,
      // A chord click has the whole callset behind it, so this is the launch
      // site where "Follow further breakends at each end" is most obviously
      // wanted -- the reader is already looking at every junction at once.
      // Without it the dialog does not offer the option at all.
      //
      // In the SV inspector the sheet holds that callset parsed already, and
      // answering from it beats asking the display's adapter, which ships the
      // records back through RPC one 2 kb window per hop to re-read them. A
      // circular view standing on its own has no sheet and keeps the adapter.
      ...(inspector?.spreadsheet
        ? { findJunctionsNear: inspector.spreadsheet.findJunctionsNear() }
        : chordTrack.adapterConfig
          ? {
              findJunctionsNear: makeFindJunctionsNear(
                chordTrack as Parameters<typeof makeFindJunctionsNear>[0],
                assemblyName,
              ),
            }
          : {}),
      // the callset the chord was drawn from, so the split view opens holding
      // the record that was clicked rather than two empty panels
      ...(inspector?.importedTrackId
        ? { defaultTrackIds: [inspector.importedTrackId] }
        : {}),
      // in the SV inspector, reuse the same view the sheet's own row menu opens
      // so a chord click and a row click don't stack two of them. Other
      // circular views get a fresh view per click
      stableViewId: inspector
        ? breakpointSplitViewId(inspector.id, assemblyName)
        : undefined,
    })
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

export default function SvInspectorViewF(pluginManager: PluginManager) {
  /** #jexlFunction Slot defaults from plugins | defaultOnChordClick(feature, track, pluginManager) | opens a breakpoint split view on the clicked chord */
  pluginManager.jexl.addFunction('defaultOnChordClick', defaultOnChordClick)
  /** #jexlFunction Slot defaults from plugins | svChordColor(feature) | the SV-type color the inspector's chords are drawn in */
  pluginManager.jexl.addFunction('svChordColor', svChordColor)

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
