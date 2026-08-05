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
   * How much of a segment to show either side of the junction it carries. A
   * path's outer segments are as long as the reads that described them happened
   * to be, and a panel opened on the whole of one is both mostly not about the
   * event and, with an alignments track carried onto it, a fetch large enough
   * for the track to refuse it and draw `force load` instead. The junctions are
   * what this view type is for, so that is what a panel opens on.
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
      // Which end of this segment is a junction: the first segment leads into
      // the path, the last is led into, and an interior one is pinned at both
      // ends (and is short for that reason, so it is shown whole).
      const [start, end] =
        seg.end - seg.start <= windowSize
          ? [seg.start, seg.end]
          : idx === 0
            ? [seg.end - windowSize, seg.end]
            : idx === segments.length - 1
              ? [seg.start, seg.start + windowSize]
              : [
                  Math.floor((seg.start + seg.end - windowSize) / 2),
                  Math.floor((seg.start + seg.end + windowSize) / 2),
                ]
      return `${seg.refName}:${Math.max(1, start + 1)}-${end}`
    }),
  }
}
