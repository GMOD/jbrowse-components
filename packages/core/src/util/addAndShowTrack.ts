import type { SessionWithAddSessionTrack } from './types/index.ts'

/**
 * Add a track config to the session, then reveal it in `view` (when given).
 * Shared by the features that stand a track up on the user's behalf — a GC
 * content track off a sequence track's menu, a consensus opened as variants, a
 * multi-wiggle built from a selection — which all add a track and then show it
 * by trackId. Returns the added config, or undefined if it was invalid
 * (surfaced as a snackbar) — see SessionTracks.addSessionTrackConf.
 *
 * Session-scoped, not published: none of these is a catalog entry, so an admin
 * clicking one must not write it into the config.json every visitor is served.
 * The Add-track workflows, which do mean that, go through
 * `addTrackFromWidget`.
 */
export function addAndShowTrack(
  session: SessionWithAddSessionTrack,
  conf: Parameters<SessionWithAddSessionTrack['addSessionTrackConf']>[0] & {
    trackId: string
  },
  view?: { showTrack: (trackId: string) => void },
) {
  const added = session.addSessionTrackConf(conf)
  // addSessionTrackConf already notified on an invalid conf; showing a trackId
  // that was never added would only add a second "Could not resolve identifier"
  // snackbar
  if (added) {
    view?.showTrack(conf.trackId)
  }
  return added
}
