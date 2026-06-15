import type { BreakpointViewStateModel } from '../BreakpointSplitView/model.ts'
import type { BreakpointSplitViewInitView } from '../BreakpointSplitView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// Every BreakpointSplitView snapshot property (showIntraviewLinks,
// interactiveOverlay, drawCRReads, ...) minus the ones the launcher controls
// itself: `type` is fixed, `id` is assigned by addView, and `views`/`init` are
// replaced by the declarative loc-based `views` below (resolved async in the
// view's afterAttach). Deriving from the model snapshot keeps this in lockstep
// with the model — any view prop is settable declaratively, fully type-checked.
type BreakpointSplitViewSnapshot = SnapshotIn<BreakpointViewStateModel>

export interface LaunchBreakpointSplitViewArgs extends Omit<
  BreakpointSplitViewSnapshot,
  'type' | 'id' | 'views' | 'init'
> {
  session: AbstractSessionModel
  views: BreakpointSplitViewInitView[]
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-BreakpointSplitView': {
      args: LaunchBreakpointSplitViewArgs
      result: LaunchBreakpointSplitViewArgs
    }
  }
}

export default function LaunchBreakpointSplitViewF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint('LaunchView-BreakpointSplitView', args => {
    const { session, views, ...rest } = args
    if (views.length < 2) {
      throw new Error(
        'BreakpointSplitView requires at least 2 views to be specified',
      )
    }
    // `rest` is the view-level snapshot overrides; `views` are declarative
    // (loc/assembly/tracks) and go through `init` so the view resolves their
    // regions once it has a width.
    session.addView('BreakpointSplitView', {
      ...rest,
      init: { views },
    })
    return args
  })
}
