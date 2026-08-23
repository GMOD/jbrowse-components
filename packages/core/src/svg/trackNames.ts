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

/**
 * Tell the user which visible tracks the export left out because their display
 * type implements no `renderSvg`. Called once per export, after the renders —
 * the stacked views flatten every row's `skippedTracks` into one call rather
 * than notifying per row.
 *
 * Skipping is deliberate (see `SvgExportTrack.renderSvg`), so this is
 * informational rather than an error. But it is not silent: a figure that is
 * quietly short a track is worse than one whose author was told why, and the
 * reader of the file has no way to tell the difference afterwards.
 */
export function notifySkippedSvgTracks(
  session: NotificationSink & TrackCatalog,
  skipped: { configuration: AnyConfigurationModel }[],
) {
  if (skipped.length === 0) {
    return
  }
  const names = skipped.map(t => svgTrackName(t, session)).join(', ')
  session.notify(
    `Not included in the SVG: ${names}. ${
      skipped.length === 1 ? 'Its display type does' : 'Their display types do'
    } not support SVG export.`,
    'info',
  )
}
