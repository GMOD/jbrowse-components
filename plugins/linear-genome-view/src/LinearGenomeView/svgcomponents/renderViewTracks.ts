import { awaitSvgRenders } from '@jbrowse/core/svg/svgReady'
import { max } from '@jbrowse/core/util'
import { svgLegendGutterWidth } from '@jbrowse/display-kit/renderDisplaySvg'

import { labelOffset, totalHeight, trackBoxOffsets } from './util.ts'

import type { ExportSvgOptions, TrackLabelMode } from '../types.ts'
import type { LgvSvgExportable } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { ThemeOptions } from '@mui/material'
import type { ReactNode } from 'react'

// Exactly what this reads off a track — duck-typed, as the displays'
// `renderSvg` models are, so the compiler catches a missing field and a test
// can drive it without standing up an MST tree. A real track reaches these
// through a pluggable union TS widens to `any`, so the callers get no checking
// from it; the point is to say what an export depends on. Everything else about
// a track (its configuration, for the labels) passes straight through, which is
// what `T` preserves.
export interface SvgExportTrack {
  minimized: boolean
  displays: {
    height: number
    regionTooLarge?: boolean
    svgSidebarWidth?: LgvSvgExportable['svgSidebarWidth']
    /**
     * Optional, and the option is the point: SVG export is a substantial extra
     * implementation for a display type, and a third-party plugin that has not
     * written one should cost its own track a place in the figure, not cost
     * everyone in the session the ability to export at all. A display without
     * one is dropped from the export the same way a minimized track is, and
     * `skippedTracks` carries it back out so the user is told which.
     */
    renderSvg?: (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
  }[]
}

export interface ViewTracksSvg<T> {
  /** the tracks that were rendered, in the order they were laid out */
  tracks: T[]
  /**
   * `legendHeight` is the room a track's key has in the gutter, absent for a
   * track with no key to draw
   */
  displayResults: { track: T; result: ReactNode; legendHeight?: number }[]
  /** total height of the stack, valid only because the renders above resolved */
  tracksHeight: number
  /** px the caller widens its canvas by for the keys right of the plot */
  legendWidth: number
  /**
   * Visible tracks left out because their display implements no `renderSvg`.
   * Not an error, but not nothing either — a figure quietly missing a track is
   * its own trap, so callers report these once per export.
   */
  skippedTracks: T[]
}

/**
 * One view's worth of exported track bodies: which tracks are in, their
 * rendered SVG, and how tall the stack ends up.
 *
 * It exists to own an ordering that each of the three view exports got wrong at
 * least once, because it is not visible at a call site that merely lists the
 * same statements in some order: the geometry is measured **after** the
 * awaits.
 *
 * - `tracksHeight`: a display whose height follows its data (grow mode;
 *   `LinearMultiRowFeatureDisplay` is `nrow * effectiveRowHeight`) only reaches
 *   its final height once `renderSvg`'s readiness wait resolves, and
 *   `SVGTracks` re-reads `displays[0].height` later still. Measuring up front
 *   sized the canvas for the pre-fetch height and the taller bodies ran off the
 *   bottom of the export — and in the breakpoint-split export it also desynced
 *   the overlay anchors, resolved after, from the view tops, which weren't.
 * - `legendWidth`: most keys list what was loaded, and on a headless export
 *   (jbrowse-img) nothing has loaded before the waits. Measured after, a track
 *   with no key reserves nothing and the figure has no empty strip.
 *
 * The minimized filter and the track order are here for the same reason: the
 * reserved height, the rendered bodies, the label gutter and (breakpoint-split)
 * the ribbon anchors must all be derived from one list, and pinned tracks are
 * drawn at the top of a view on screen.
 */
export async function renderViewTracks<T extends SvgExportTrack>({
  view,
  opts,
  theme,
  textHeight,
  trackLabels,
}: {
  view: { pinnedTracks: T[]; unpinnedTracks: T[] }
  opts: ExportSvgOptions
  theme: ThemeOptions | undefined
  textHeight: number
  trackLabels: TrackLabelMode
}): Promise<ViewTracksSvg<T>> {
  // Partitioned before anything is measured, so a skipped track reserves no
  // height and takes no place in the label gutter — the alternative is a figure
  // with a labelled empty band where the track would have been. One pass, so
  // the test for "can this render" is written once and the two lists cannot
  // disagree about a track.
  const tracks: T[] = []
  const skippedTracks: T[] = []
  for (const track of [...view.pinnedTracks, ...view.unpinnedTracks]) {
    if (!track.minimized) {
      ;(track.displays[0]?.renderSvg ? tracks : skippedTracks).push(track)
    }
  }
  // `awaitSvgRenders` over `Promise.all`: a track whose data won't load fails
  // the export, and a view with three broken tracks should say so once rather
  // than name whichever rejected first
  const displayResults = await awaitSvgRenders(
    tracks.map(async track => ({
      track,
      result: await track.displays[0]!.renderSvg!({ ...opts, theme }),
    })),
  )
  const tracksHeight = totalHeight(tracks, trackLabels, textHeight)
  const keyed = tracks.map(
    track =>
      !track.displays[0]!.regionTooLarge &&
      svgLegendGutterWidth(track.displays[0]!, theme, Infinity) > 0,
  )
  const bodyTops = trackBoxOffsets(tracks, trackLabels, textHeight).map(
    (top, i) => top + labelOffset(tracks[i]!, trackLabels, textHeight),
  )
  // A key runs from its body's top to the next keyed body's, or to the foot of
  // the stack, so a long key beside a short track carries on past the unkeyed
  // tracks below it before it cuts to "+N more".
  const legendHeights = keyed.map((isKeyed, i) => {
    const next = keyed.findIndex((k, j) => k && j > i)
    return isKeyed
      ? (next === -1 ? tracksHeight : bodyTops[next]!) - bodyTops[i]!
      : undefined
  })
  return {
    tracks,
    displayResults: displayResults.map((r, i) => ({
      ...r,
      legendHeight: legendHeights[i],
    })),
    tracksHeight,
    legendWidth: max(
      tracks.map((track, i) => {
        const height = legendHeights[i]
        return height === undefined
          ? 0
          : svgLegendGutterWidth(track.displays[0]!, theme, height)
      }),
      0,
    ),
    skippedTracks,
  }
}
