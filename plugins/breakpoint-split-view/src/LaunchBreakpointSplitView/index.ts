import type { BreakpointViewStateModel } from '../BreakpointSplitView/model.ts'
import type { BreakpointSplitViewCommands } from '../BreakpointSplitView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// The args are a view object: every BreakpointSplitView snapshot property
// (showIntraviewLinks, interactiveOverlay, linkViews, showHeader, ...) beside
// the declarative `views` the commands declare, minus the ones a launch never
// writes — `type` is fixed and `init`/`launch` are the partition's own blob.
// `id` stays, so a session spec can pin the created view's id. Deriving from
// the model snapshot keeps this in lockstep with the model — any view prop is
// settable declaratively, fully type-checked.
type BreakpointSplitViewSnapshot = SnapshotIn<BreakpointViewStateModel>

export interface LaunchBreakpointSplitViewArgs
  extends
    Omit<BreakpointSplitViewSnapshot, 'type' | 'views' | 'init' | 'launch'>,
    BreakpointSplitViewCommands {
  session: AbstractViewContainer
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
  /** #extensionPoint LaunchView-BreakpointSplitView | async | Programmatically launch a breakpoint split view */
  pluginManager.addToExtensionPoint('LaunchView-BreakpointSplitView', args => {
    const { session, ...spec } = args
    const { views } = spec
    if (!Array.isArray(views)) {
      throw new Error(
        `BreakpointSplitView launch needs a "views" array of panels, but got ${JSON.stringify(views)}`,
      )
    }
    if (views.length < 2) {
      throw new Error(
        'BreakpointSplitView requires at least 2 views to be specified',
      )
    }
    // Nothing is sorted here — the view's own preProcessSnapshot tells the
    // declarative panels from the built rows a saved session carries, which is
    // what makes a spec, a `defaultSession` view and an `addView` literal one
    // shape.
    session.addView('BreakpointSplitView', spec)
    return args
  })
}
