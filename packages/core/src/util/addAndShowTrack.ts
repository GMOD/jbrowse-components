import type { SessionWithAddTracks } from './types/index.ts'

/**
 * Add a track config to the session, then reveal it in `view` (when given).
 * Shared by the add-track workflows, which all add a track and then show it by
 * trackId. Returns the added config, or undefined if it was invalid (surfaced
 * as a snackbar) — see SessionTracks.addTrackConf.
 */
export function addAndShowTrack(
  session: SessionWithAddTracks,
  conf: Parameters<SessionWithAddTracks['addTrackConf']>[0] & {
    trackId: string
  },
  view?: { showTrack: (trackId: string) => void },
) {
  const added = session.addTrackConf(conf)
  // addTrackConf already notified on an invalid conf; showing a trackId that was
  // never added would only add a second "Could not resolve identifier" snackbar
  if (added) {
    view?.showTrack(conf.trackId)
  }
  return added
}
