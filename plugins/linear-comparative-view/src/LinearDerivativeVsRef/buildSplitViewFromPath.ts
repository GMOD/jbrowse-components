import { stripTrackIds } from '@jbrowse/core/util'

import { derivativePathLabel } from './buildDerivativeVsRefSpec.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

// The shape `stripTrackIds` takes. Declared here rather than imported: core
// keeps its `TrackSnapshot` internal, and this only needs the two identifier
// fields that get stripped.
interface TrackSnapshot {
  id: string
  displays: { id: string; [key: string]: unknown }[]
  [key: string]: unknown
}

export interface SplitViewFromPathSpec {
  viewSnapshot: {
    type: 'BreakpointSplitView'
    displayName: string
    views: {
      type: 'LinearGenomeView'
      hideHeader: true
      tracks: unknown[]
    }[]
  }
  /** One locstring per panel, in derivative order, to navigate each to. */
  locStrings: string[]
}

/**
 * #api
 * A breakpoint split view over the loci a reconstructed path visits.
 *
 * ONE PANEL PER SEGMENT, not per chromosome. The segments are already in the
 * order the reads cross them, so a path that leaves chr9 and comes back to it
 * inverted gets two chr9 panels rather than one that quietly merges the two
 * visits — which is the case a hand-built import form gets wrong, since a person
 * filling in rows types each chromosome once.
 *
 * The launching view's tracks are carried onto every panel, alignments tracks
 * included, because the reads leaving one panel and arriving in the next are the
 * whole content of this view type.
 */
export function buildSplitViewFromPath({
  candidate,
  tracks,
  windowSize = 10_000,
}: {
  candidate: DerivativeCandidate
  tracks: TrackSnapshot[]
  /**
   * The span EVERY panel opens on, centred on the junction it carries.
   *
   * Two things make it one span rather than a per-segment fit. A path's outer
   * segments are as long as the reads that described them happened to be, so a
   * panel over the whole of one is mostly not about the event and, with an
   * alignments track carried onto it, a fetch large enough for the track to
   * refuse it and draw `force load` instead. And a short interior segment — 199
   * bp between two junctions is ordinary — drawn at its own length puts that
   * panel fifty times closer in than its neighbours, which is what the
   * connecting curves are drawn between: at mismatched zooms every read leaves
   * one panel in a corner and the fan runs off the frame rather than reading as
   * one route through the reference (reviewer, on exactly that figure).
   */
  windowSize?: number
}): SplitViewFromPathSpec {
  const stripped = stripTrackIds(tracks)
  const { segments } = candidate
  return {
    viewSnapshot: {
      type: 'BreakpointSplitView',
      displayName: derivativePathLabel(candidate),
      views: segments.map(() => ({
        type: 'LinearGenomeView' as const,
        hideHeader: true as const,
        tracks: stripped,
      })),
    },
    // Raw, unformatted locstrings: these are parsed back by navToLocString, and
    // the formatted spelling carries thousand separators that move with the
    // numberGrouping display preference.
    locStrings: segments.map((seg, idx) => {
      // Which base this panel is about: the first segment leads into the path,
      // so its junction is the end the path LEAVES it by; the last is led into,
      // so its junction is the end the path ARRIVES at; an interior one is
      // pinned at both ends, so its centre is.
      //
      // Which reference coordinate that is depends on the strand, and getting it
      // wrong is invisible rather than loud: an inverted segment is crossed from
      // its high coordinate to its low one, so a path arriving at an inverted
      // last segment arrives at `end`. Anchored on `start` regardless, the panel
      // opened a segment-length away from where the reads actually land, and the
      // curves into it had nothing on screen to attach to — the last panel of a
      // four-segment fold-back simply drew no connections at all.
      //
      // Centred rather than butted against the junction, which put every
      // attachment on a panel edge and every curve in a corner. The flank past
      // a junction is reference the derivative does not carry, and showing it is
      // the point: it is where the reads stop.
      const reversed = seg.strand === -1
      const anchor =
        idx === 0
          ? reversed
            ? seg.start
            : seg.end
          : idx === segments.length - 1
            ? reversed
              ? seg.end
              : seg.start
            : Math.floor((seg.start + seg.end) / 2)
      const half = Math.floor(windowSize / 2)
      const start = Math.max(0, anchor - half)
      return `${seg.refName}:${start + 1}-${start + windowSize}`
    }),
  }
}
