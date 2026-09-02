import { launchOrReplaceView } from '@jbrowse/core/util'

import type {
  AbstractViewContainer,
  AbstractViewModel,
} from '@jbrowse/core/util'

// Both synteny LaunchView handlers do the same two things: reject a spec with
// fewer than two views, then open the view on it. Kept in one place so the
// "needs at least 2 views" contract and the addView call stay identical between
// the linear and dotplot launchers.
//
// `spec` is a view object — every setting written directly on it, the way a
// `defaultSession` view and an `addView` literal are. The view's own
// `preProcessSnapshot` sorts the launch keys from the properties, so nothing is
// partitioned here. `id` rides along so MST's optional identifier honors the
// spec's pin; undefined falls back to an auto-generated one.
export async function launchSyntenyView<T extends { views: unknown[] }>({
  session,
  viewType,
  spec,
  id,
  replacing,
}: {
  session: AbstractViewContainer
  viewType: string
  spec: T
  id?: string
  // The view this launch came out of, when the launcher offered to swap it for
  // the result instead of appending below it. A session that can't replace a
  // view (the single-view embedded products) falls back to appending, so a
  // caller never has to ask twice.
  replacing?: AbstractViewModel
}) {
  if (spec.views.length < 2) {
    throw new Error(`${viewType} requires at least 2 views to be specified`)
  }
  return launchOrReplaceView({
    session,
    typeName: viewType,
    initialState: { id, ...spec },
    replacing,
  })
}
