import { coarseStripHTML } from '../util/index.ts'
import { getTrackName } from '../util/tracks.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { NotificationSink, TrackCatalog } from '../util/index.ts'

/**
 * The name an export writes for a track. HTML in a config's name is stripped
 * before it is measured or drawn, so the reserved gutter matches the glyphs.
 *
 * In core rather than in the LGV plugin because the skip notification below has
 * to name tracks the same way the labels do, and the views that need to send it
 * are not all LGV-family — a circular view depends on neither.
 */
export function svgTrackName(
  track: { configuration: AnyConfigurationModel },
  session: TrackCatalog,
) {
  return coarseStripHTML(getTrackName(track.configuration, session))
}

const SKIPPED_NOTICE = 'Not included in the SVG:'

/**
 * Whether a session notice is one `notifySkippedSvgTracks` sent, for a host
 * with no snackbar to show it, such as jb2export.
 */
export function isSkippedSvgNotice(message: string) {
  return message.startsWith(SKIPPED_NOTICE)
}

/**
 * Tell the user which visible tracks the export left out, by default because
 * their display type implements no `renderSvg`. Called once per reason per
 * export, after the renders — the stacked views flatten every row's
 * `skippedTracks` into one call rather than notifying per row.
 *
 * A track shown in several rows is named once.
 *
 * Skipping is deliberate (see `SvgExportTrack.renderSvg`), so this is
 * informational rather than an error. But it is not silent: a figure that is
 * quietly short a track is worse than one whose author was told why, and the
 * reader of the file has no way to tell the difference afterwards.
 */
export function notifySkippedSvgTracks(
  session: NotificationSink & TrackCatalog,
  skipped: { configuration: AnyConfigurationModel }[],
  reason?: string,
) {
  const names = [...new Set(skipped.map(t => svgTrackName(t, session)))]
  if (names.length > 0) {
    const why =
      reason ??
      `${names.length === 1 ? 'Its display type does' : 'Their display types do'} not support SVG export.`
    session.notify(`${SKIPPED_NOTICE} ${names.join(', ')}. ${why}`, 'info')
  }
}
