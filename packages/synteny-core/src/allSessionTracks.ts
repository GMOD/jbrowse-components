import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * Every track config the session can show, connection-supplied ones included.
 *
 * `session.tracks` is only sessionTracks plus the admin config (see
 * product-core's SessionTracks), so a synteny track that arrived from a hub or
 * registry connection is absent from it while still being toggleable from the
 * track selector, which unions the same two sources. The synteny and dotplot
 * import forms have to see the same set the track selector does, or a pair whose
 * only synteny dataset comes from a connection reads as "not configured".
 */
export function allSessionTracks(session: AbstractSessionModel) {
  const connectionTracks = (session.connectionInstances ?? []).flatMap(
    conn => conn.tracks,
  )
  return connectionTracks.length
    ? [...session.tracks, ...connectionTracks]
    : session.tracks
}
