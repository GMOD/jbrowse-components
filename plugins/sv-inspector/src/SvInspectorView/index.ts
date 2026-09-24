import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { unwrapFeature } from '@jbrowse/core/util/simpleFeature'
import { getParent } from '@jbrowse/mobx-state-tree'
import {
  breakpointSplitViewId,
  launchBreakpointSplitView,
  makeFindJunctionsNear,
} from '@jbrowse/sv-core'

import { svInspectorLaunchKeys } from './launchKeys.ts'
import { svChordColor } from './svChordColor.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { FindJunctionsNear, SvEvent } from '@jbrowse/sv-core'

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
        drilldownTrackIds: string[]
        spreadsheet?: {
          findJunctionsNear: () => FindJunctionsNear
          svEventFor: (feature: { uniqueId: string }) => SvEvent | undefined
        }
      }
    }>(view)
    const inspector =
      parentView.type === 'SvInspectorView'
        ? parentView.spreadsheetView
        : undefined
    const sheet = inspector?.spreadsheet
    // the inspector's sheet holds the callset parsed already, which beats the
    // adapter re-reading it over RPC one 2 kb window per hop
    const findJunctionsNear = sheet
      ? sheet.findJunctionsNear()
      : chordTrack.adapterConfig
        ? makeFindJunctionsNear(
            chordTrack as Parameters<typeof makeFindJunctionsNear>[0],
            assemblyName,
          )
        : undefined
    launchBreakpointSplitView({
      session,
      feature,
      assemblyName,
      findJunctionsNear,
      event: sheet?.svEventFor({ uniqueId: unwrapFeature(feature).id() }),
      defaultTrackIds: inspector?.drilldownTrackIds,
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
    // the factory embeds the SpreadsheetView and CircularView state models as
    // sub-model props, so their loaders resolve first
    const stateModel = async (): Promise<
      ViewTypeRegistry['SvInspectorView']
    > => {
      await Promise.all([
        pluginManager.getViewType('SpreadsheetView').loadStateModel(),
        pluginManager.getViewType('CircularView').loadStateModel(),
      ])
      return import('./model.ts').then(f => f.default(pluginManager))
    }
    return new ViewType({
      name: 'SvInspectorView',
      displayName: 'SV inspector',
      stateModel,
      launchKeys: svInspectorLaunchKeys,
      ReactComponent: lazy(() => import('./components/SvInspectorView.tsx')),
    })
  })
}
