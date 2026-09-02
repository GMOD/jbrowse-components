import { launchSyntenyView } from '@jbrowse/synteny-core'

import { normalizeTrackLevels } from './LinearSyntenyView/util/initHelpers.ts'

import type { LinearSyntenyViewInit } from './LinearSyntenyView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

/**
 * The view's own `init` contract plus where to put it. Derived from the view's
 * types rather than restated: everything but `session`/`id` is forwarded
 * verbatim by the handler, so a hand-copied subset only ever meant that a field
 * the view already honored (`collapseEmptyRows`, a row's LGV launch props) was
 * rejected by the type while working perfectly at runtime.
 */
export interface LaunchLinearSyntenyViewArgs extends Omit<
  LinearSyntenyViewInit,
  'views'
> {
  session: AbstractViewContainer
  // optional explicit view id, so another view in the same session spec can
  // reference this one
  id?: string
  // optional, unlike the view's own: the extension point receives untrusted
  // runtime spec data, so a malformed spec can omit it — the handler defaults it
  // to an empty stack rather than throwing on a missing property
  views?: LinearSyntenyViewInit['views']
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-LinearSyntenyView': {
      args: LaunchLinearSyntenyViewArgs
      result: LaunchLinearSyntenyViewArgs
    }
  }
}

export default function LaunchLinearSyntenyView(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-LinearSyntenyView | async | Programmatically launch a linear synteny view */
  pluginManager.addToExtensionPoint(
    'LaunchView-LinearSyntenyView',
    async args => {
      // Everything but session/id is a view object and forwards verbatim: the
      // view's own preProcessSnapshot sorts the launch keys from the
      // properties. `tracks` is normalized here rather than there because the
      // flat string[] shorthand means "all on level 0", which only this view
      // knows.
      const { session, id, views = [], tracks = [], ...rest } = args
      await launchSyntenyView({
        session,
        id,
        viewType: 'LinearSyntenyView',
        spec: { views, tracks: normalizeTrackLevels(tracks), ...rest },
      })
      return args
    },
  )
}
