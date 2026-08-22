import type { BreakpointViewStateModel } from '../BreakpointSplitView/model.ts'
import type { BreakpointSplitViewInitView } from '../BreakpointSplitView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// Every BreakpointSplitView snapshot property (showIntraviewLinks,
// interactiveOverlay, linkViews, showHeader, ...) minus the ones the launcher controls
// itself: `type` is fixed, and `views`/`init` are replaced by the declarative
// loc-based `views` below (resolved async in the view's afterAttach). `id` stays,
// so a session spec can pin the created view's id. Deriving from the model
// snapshot keeps this in lockstep with the model — any view prop is settable
// declaratively, fully type-checked.
type BreakpointSplitViewSnapshot = SnapshotIn<BreakpointViewStateModel>

export interface LaunchBreakpointSplitViewArgs extends Omit<
  BreakpointSplitViewSnapshot,
  'type' | 'views' | 'init'
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
  /** #extensionPoint LaunchView-BreakpointSplitView | async | Programmatically launch a breakpoint split view */
  pluginManager.addToExtensionPoint(
    'LaunchView-BreakpointSplitView',
    async args => {
      const { session, views, ...rest } = args
      if (!Array.isArray(views)) {
        // Naming the likely cause beats the `views.length` TypeError this used to
        // throw: `init` is the config/defaultSession spelling and a session spec
        // takes the panels flat, which is easy to get backwards because the view's
        // own snapshot property really is called `init`.
        throw new Error(
          `BreakpointSplitView launch needs a "views" array of panels, but got ${JSON.stringify(
            views,
          )}. A session spec passes the panels flat as "views"; "init" is the config/defaultSession form.`,
        )
      }
      if (views.length < 2) {
        throw new Error(
          'BreakpointSplitView requires at least 2 views to be specified',
        )
      }
      // `rest` is the view-level snapshot overrides; `views` are declarative
      // (loc/assembly/tracks) and go through `init` so the view resolves their
      // regions once it has a width.
      await session.launchView('BreakpointSplitView', {
        ...rest,
        init: views,
      })
      return args
    },
  )
}
