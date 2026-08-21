import { stripTrackIds } from '@jbrowse/core/util'

import { derivativePathLabel } from './buildDerivativeVsRefSpec.ts'

import type {
  DerivativeCandidate,
  DerivativeSegment,
} from '@jbrowse/plugin-alignments'

/**
 * Most panels a reconstruction may be drawn as. Every panel carries the
 * launching view's whole track list, alignments included, so a panel is another
 * pileup fetch over `windowSize` — and nothing upstream bounds a path's segment
 * count: a real ngmlr-aligned ONT record in COLO829 carries 943 SA entries, and
 * a path built from one would ask for 943 panels and 943 fetches.
 *
 * Twelve because that is already past what the view can say. Its content is the
 * reads leaving one panel and arriving in the next, and a dozen panels of a
 * pileup each is a stack taller than a screen: the fan a reader is meant to
 * follow no longer fits in one look, whatever the machine does with the fetches.
 *
 * The picker disables "Breakpoint split view" above this rather than truncating,
 * because a prefix of a path drawn under the path's own name is the failure the
 * strip's own gap squeeze exists to avoid — the synteny drawing has no such
 * limit and remains offered. `buildSplitViewFromPath` refuses above it too, so
 * a caller that never had a picker cannot walk into the 943-panel case.
 */
export const MAX_SPLIT_PANELS = 12

// The read enters a forward segment at its lower coordinate and a reverse one at
// its higher, so every edge here is asked for by ROLE — entry/exit along the
// read — rather than by min/max. Getting that wrong is invisible rather than
// loud: an inverted segment is crossed from its high coordinate to its low one,
// so a path arriving at an inverted last segment arrives at `end`. Anchored on
// `start` regardless, the panel opened a segment-length away from where the
// reads actually land, and the curves into it had nothing on screen to attach to
// — the last panel of a four-segment fold-back simply drew no connections at
// all.
//
// Centred on its junction rather than butted against it, which put every
// attachment on a panel edge and every curve in a corner. The flank past a
// junction is reference the derivative does not carry, and showing it is the
// point: it is where the reads stop.
function panelAnchor(
  seg: DerivativeSegment,
  idx: number,
  count: number,
  windowSize: number,
) {
  const entry = seg.strand === -1 ? seg.end : seg.start
  const exit = seg.strand === -1 ? seg.start : seg.end
  const middle = Math.floor((seg.start + seg.end) / 2)
  // The first segment leads into the path, so its junction is the end the path
  // LEAVES it by; the last is led into, so its junction is the end it ARRIVES
  // at. A lone segment has no junction to be about — no caller in tree produces
  // one, since a chain of one describes no rearrangement, but this is `#api`.
  if (count === 1) {
    return middle
  }
  if (idx === 0) {
    return exit
  }
  if (idx === count - 1) {
    return entry
  }
  // An interior segment is pinned by a junction at BOTH ends, so its centre
  // shows both — while it fits the window every panel shares. Past that the
  // midpoint is more than half a window from either junction, so the panel opens
  // on reference carrying no junction, no reads, and nothing for the curves on
  // either side to attach to: the same empty panel the inverted-anchor bug above
  // produced, from the branch that fixed it. Only the SHORT interior segment the
  // midpoint was chosen for (199 bp between two junctions is ordinary) is
  // actually served by it, and nothing bounds an interior segment's length —
  // only its edges are pinned. A long one falls back to the junction it is
  // reached by, which is one attachment the curves can find instead of none.
  return seg.end - seg.start <= windowSize ? middle : entry
}

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
 *
 * One panel per segment is also one fetch per segment, and nothing bounds a
 * path's segment count, so **this throws above {@link MAX_SPLIT_PANELS}
 * segments**. Truncating instead would draw a prefix of a path under the whole
 * path's name, which is the failure the strip's own gap squeeze exists to
 * avoid, and returning a snapshot the caller has to measure is a rule to
 * remember rather than one the code holds. The in-tree picker never reaches the
 * throw — it disables the option and offers synteny, which has no such limit.
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
  if (segments.length > MAX_SPLIT_PANELS) {
    throw new Error(
      `This path visits ${segments.length} segments and a breakpoint split view draws one panel per segment, each carrying the launching view's whole track list — past ${MAX_SPLIT_PANELS} that is more fetches than the drawing can say anything with. Draw the path as synteny instead, which has no such limit.`,
    )
  }
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
      const anchor = panelAnchor(seg, idx, segments.length, windowSize)
      const half = Math.floor(windowSize / 2)
      const start = Math.max(0, anchor - half)
      return `${seg.refName}:${start + 1}-${start + windowSize}`
    }),
  }
}
