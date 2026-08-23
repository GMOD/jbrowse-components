import { addOrReplaceView } from '@jbrowse/core/util'

import type {
  AbstractViewContainer,
  AbstractViewModel,
} from '@jbrowse/core/util'

// Both synteny LaunchView handlers do the same two things: reject a spec with
// fewer than two views, then open the view with its assembled init block. Kept
// in one place so the "needs at least 2 views" contract and the addView call
// stay identical between the linear and dotplot launchers.
//
// `id` is the spec's optional view-id pin, passed top-level so MST's optional
// identifier honors it (undefined falls back to an auto-generated id). It must
// not ride inside `init`, where the view's init autorun would ignore it.
export function launchSyntenyView<T extends { views: unknown[] }>({
  session,
  viewType,
  init,
  id,
  replacing,
}: {
  session: AbstractViewContainer
  viewType: string
  init: T
  id?: string
  // The view this launch came out of, when the launcher offered to swap it for
  // the result instead of appending below it. A session that can't replace a
  // view (the single-view embedded products) falls back to appending, so a
  // caller never has to ask twice.
  replacing?: AbstractViewModel
}) {
  if (init.views.length < 2) {
    throw new Error(`${viewType} requires at least 2 views to be specified`)
  }
  return addOrReplaceView({
    session,
    typeName: viewType,
    initialState: { id, init },
    replacing,
  })
}
