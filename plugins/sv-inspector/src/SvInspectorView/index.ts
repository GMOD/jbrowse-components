import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'
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
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { FindJunctionsNear, SvEvent } from '@jbrowse/sv-core'

// the chord display passes itself as `track`
function defaultOnChordClick(
  feature: Feature,
  chordDisplay: IStateTreeNode & { adapterConfig: Record<string, unknown> },
) {
  const session = getSession(chordDisplay)
  try {
    const view = getContainingView(chordDisplay)
    const assemblyName = view.assemblyNames?.[0]
    if (!assemblyName) {
      return
    }
    session.setSelection(feature)
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
    launchBreakpointSplitView({
      session,
      feature,
      assemblyName,
      // the sheet has the callset parsed already; the adapter re-reads it
      // over RPC per hop
      findJunctionsNear: sheet
        ? sheet.findJunctionsNear()
        : makeFindJunctionsNear(chordDisplay, assemblyName),
      event: sheet?.svEventFor({ uniqueId: unwrapFeature(feature).id() }),
      defaultTrackIds: inspector?.drilldownTrackIds,
      // shared with the sheet's row menu, so the two don't stack views
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
    // the model embeds both of these state models
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
      ReactComponent: lazyWithPreload(
        () => import('./components/SvInspectorView.tsx'),
      ),
    })
  })
}
