import type { AbstractSessionModel } from '@jbrowse/core/util'

// Both synteny LaunchView handlers do the same two things: reject a spec with
// fewer than two views, then open the view with its assembled init block. Kept
// in one place so the "needs at least 2 views" contract and the addView call
// stay identical between the linear and dotplot launchers.
export function launchSyntenyView<T extends { views: unknown[] }>(
  session: AbstractSessionModel,
  viewType: string,
  init: T,
) {
  if (init.views.length < 2) {
    throw new Error(`${viewType} requires at least 2 views to be specified`)
  }
  return session.addView(viewType, { init })
}
