import { awaitSvgRenders } from '@jbrowse/core/svg/svgReady'
import { max } from '@jbrowse/core/util'

import { totalHeight } from './util.ts'

import type { ExportSvgOptions, TrackLabelMode } from '../types.ts'
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
    svgLegendWidth?: () => number
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
  displayResults: { track: T; result: ReactNode }[]
  /** total height of the stack, valid only because the renders above resolved */
  tracksHeight: number
  /** 0 unless `reserveLegendWidth` was asked for */
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
 * It exists to own the two orderings that each of the three view exports got
 * wrong at least once, because neither is visible at a call site that merely
 * lists the same statements in some order:
 *
 * - `legendWidth` is measured **before** the awaits, because it is an input to
 *   them: a display draws its legend beside its body or floating over it
 *   depending on whether the container reserved room. That is why
 *   `svgLegendWidth` is specified as a function of the *settings* and not of
 *   the loaded data — see LinearHicDisplay's implementation.
 * - `tracksHeight` is measured **after** them. A display whose height follows
 *   its data (grow mode; `LinearMultiRowFeatureDisplay` is `nrow *
 *   effectiveRowHeight`) only reaches its final height once `renderSvg`'s
 *   readiness wait resolves, and `SVGTracks` re-reads `displays[0].height`
 *   later still. Measuring up front sized the canvas for the pre-fetch height
 *   and the taller bodies ran off the bottom of the export — and in the
 *   breakpoint-split export it also desynced the overlay anchors, resolved
 *   after, from the view tops, which weren't.
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
  reserveLegendWidth = false,
}: {
  view: { pinnedTracks: T[]; unpinnedTracks: T[] }
  opts: ExportSvgOptions
  theme: ThemeOptions | undefined
  textHeight: number
  trackLabels: TrackLabelMode
  // Whether the caller widens its canvas by the returned `legendWidth`. Off by
  // default: a stacked export (synteny, breakpoint-split) has no gutter to give
  // a legend, so its displays float theirs over the plot instead.
  reserveLegendWidth?: boolean
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
  const legendWidth = reserveLegendWidth
    ? max(
        tracks.map(track => track.displays[0]!.svgLegendWidth?.() ?? 0),
        0,
      )
    : 0
  // `awaitSvgRenders` over `Promise.all`: a track whose data won't load fails
  // the export, and a view with three broken tracks should say so once rather
  // than name whichever rejected first
  const displayResults = await awaitSvgRenders(
    tracks.map(async track => ({
      track,
      result: await track.displays[0]!.renderSvg!({
        ...opts,
        theme,
        legendWidth,
      }),
    })),
  )
  return {
    tracks,
    displayResults,
    tracksHeight: totalHeight(tracks, textHeight, trackLabels),
    legendWidth,
    skippedTracks,
  }
}
