import { parseCigar2 } from '@jbrowse/cigar-utils'
import { assembleLocString } from '@jbrowse/core/util'
import { launchSyntenyView } from '@jbrowse/synteny-core'

import { getCigar, getMate } from '../syntenyMate.ts'
import { findPosInCigar } from './findPosInCigar.ts'

import type { LinearSyntenyViewInit } from '../LinearSyntenyView/types.ts'
import type { SyntenyMate } from '../syntenyMate.ts'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  Feature,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

// The clicked block's genomic span, used to clip the launched synteny view to
// the region of interest. Only the span matters — the refName is the feature's
// by construction (the block is the one the feature was drawn in).
export interface RegionOfInterest {
  start: number
  end: number
}

// Given a CIGAR-walked offset `mateX` along the mate axis, place it back on
// genomic coordinates. The mate's genomic span is mate.start..mate.end. For
// forward-strand alignments we walk forward from mate.start; for reverse
// strand we walk backward from mate.end. `strand === undefined` is treated as
// forward (avoids `* 0` zeroing out the offset).
function mateOffsetToGenomic(
  mate: Pick<SyntenyMate, 'start' | 'end'>,
  mateOffset: number,
  strand: number | undefined,
) {
  return strand === -1 ? mate.end - mateOffset : mate.start + mateOffset
}

// The two spans one alignment contributes: its slice of the anchor axis and the
// matching slice of its mate. Without a region of interest the whole block is
// used; with one, both sides are narrowed to the slice the user asked for — the
// feature axis directly, the mate axis by walking the CIGAR.
//
// Offsets past either end of the CIGAR are capped by findPosInCigar, and a
// region starting left of the feature yields a negative offset that breaks the
// walk immediately, so the result is always clipped to the block without needing
// an explicit intersection.
//
// **An alignment with no CIGAR is still clipped**, by interpolating across the
// block instead of walking it. That is not a lesser approximation of the walk —
// it is exactly the geometry such a block is *drawn* with: no per-base
// correspondence is known, so the ribbon is a straight quadrilateral between the
// two blocks' corners, and reading the mate position off that straight edge is
// the same answer the picture gives. CIGAR-less blocks are the common case, not
// an edge one: a PAF from minimap2 without `-c` carries no `cg` tag, and neither
// do MashMap, MCScan or the coarse PIF tier. Framing every panel on the whole
// block instead meant a rubberband over one gene of a megabase-long asm5 block
// opened the whole megabase, on both sides, with no sign the selection had been
// ignored.
function resolveSpans({
  feature,
  mate,
  region,
}: {
  feature: Feature
  mate: SyntenyMate
  region: RegionOfInterest | undefined
}) {
  const cigar = getCigar(feature)
  const strand = feature.get('strand')
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  if (!region) {
    return {
      featStart,
      featEnd,
      mateStart: mate.start,
      mateEnd: mate.end,
    }
  }
  if (cigar) {
    const p = parseCigar2(cigar)
    const [fStartX, mStartX] = findPosInCigar(p, region.start - featStart)
    const [fEndX, mEndX] = findPosInCigar(p, region.end - featStart)
    return {
      featStart: featStart + fStartX,
      featEnd: featStart + fEndX,
      mateStart: mateOffsetToGenomic(mate, mStartX, strand),
      mateEnd: mateOffsetToGenomic(mate, mEndX, strand),
    }
  }
  // clamped to the block first, so a selection wider than the alignment (or
  // starting left of it) lands back on the block's own ends rather than
  // extrapolating off either side of the mate
  const clamp = (x: number) => Math.min(Math.max(x, featStart), featEnd)
  const lo = clamp(region.start)
  const hi = clamp(region.end)
  const featLen = featEnd - featStart
  const mateLen = mate.end - mate.start
  // a zero-length block has no interior to interpolate across; both ends map to
  // the mate's own start, which the caller widens to one base
  const mateOffset = (x: number) =>
    featLen > 0 ? ((x - featStart) / featLen) * mateLen : 0
  return {
    featStart: lo,
    featEnd: hi,
    mateStart: mateOffsetToGenomic(mate, mateOffset(lo), strand),
    mateEnd: mateOffsetToGenomic(mate, mateOffset(hi), strand),
  }
}

/**
 * Where one alignment's panel will open, before window padding — the same
 * resolution the launch itself runs, so the region dialog's panel list can
 * preview the view it is about to build instead of restating the whole block.
 * `undefined` for a feature with no mate, which is not a panel.
 */
export function resolvedMateSpan(
  feature: Feature,
  region: RegionOfInterest | undefined,
) {
  const mate = getMate(feature)
  if (!mate) {
    return undefined
  }
  const { mateStart, mateEnd } = resolveSpans({ feature, mate, region })
  return {
    refName: mate.refName,
    // a reverse-strand walk counts down, so the two ends arrive swapped
    start: Math.floor(Math.min(mateStart, mateEnd)),
    end: Math.ceil(Math.max(mateStart, mateEnd)),
    reversed: feature.get('strand') === -1,
  }
}

// Pad a span by windowSize and render it as a locstring. assembleLocString is
// what makes this 1-based: navToLocString parses the result back as 1-based
// inclusive, so emitting the raw interbase start would open the view one base
// left of the alignment. min/max because a reverse-strand mate walk produces
// end < start; the `end` floor is raised to keep at least one base, since a
// zero-width span (windowSize 0 over a single-base CIGAR mapping) would
// assemble into an inverted locstring.
function paddedLocString({
  refName,
  start,
  end,
  windowSize,
  reversed,
}: {
  refName: string
  start: number
  end: number
  windowSize: number
  reversed?: boolean
}) {
  const lo = Math.max(0, Math.floor(Math.min(start, end) - windowSize))
  return assembleLocString({
    refName,
    start: lo,
    end: Math.max(lo + 1, Math.floor(Math.max(start, end) + windowSize)),
    reversed,
  })
}

export interface BuildSyntenyViewSpecArgs {
  // One alignment per launched mate panel, all anchored on the same assembly and
  // refName. A single feature is the pairwise launch; N features (the mates at
  // one locus of an all-vs-all track) is the multi-way launch, and the panels
  // are drawn in the order given.
  features: Feature[]
  // The assembly the anchor panel opens on. Passed rather than read off the
  // feature: the launching view already knows it, and a feature whose
  // `assemblyName` field is missing would otherwise silently produce a panel
  // with no assembly at all.
  anchorAssembly: string
  // Where the anchor sits in the launched stack, 0 (the top) by default. A band
  // is drawn between adjacent panels only, so with three or more panels off a
  // reference-anchored dataset the anchor's position decides how many bands are
  // direct pairs: on top, only the first is; in the middle, the two either side
  // of it are. The launch dialog exposes it as a draggable row.
  anchorIndex?: number
  windowSize: number
  trackId: string
  // Open a mate panel reversed when its alignment is on the minus strand, so its
  // coordinates still run left to right alongside the anchor's.
  flipReversedMates: boolean
  // Open the launched panels collapsed to their rulers. Unset means the launch's
  // own default: a multi-way launch collapses (a mate panel gets no tracks, so
  // on a stack the per-row "No tracks active" block is the tallest thing in the
  // view), a pairwise one does not, since two rows have the room. The dialog's
  // checkbox passes it explicitly either way. A row that HAS tracks never
  // collapses whatever this says — see buildViews' scalebarOnly.
  collapseEmptyRows?: boolean
  // Tracks for the anchor panel, normally the launching view's own (see
  // anchorPanelTracks). Only the anchor row: it is the only panel whose assembly
  // the source view can speak for.
  anchorTracks?: TrackInit[]
  region?: RegionOfInterest
}

// Pure snapshot builder for the launched synteny view, mirroring
// buildReadVsRefSpec — session mutation is the caller's
// (launchSyntenyViewForFeatures below), so the coordinate math is testable
// without a session.
export function buildSyntenyViewSpec({
  features,
  anchorAssembly,
  anchorIndex = 0,
  windowSize,
  trackId,
  flipReversedMates,
  collapseEmptyRows,
  anchorTracks,
  region,
}: BuildSyntenyViewSpecArgs): { init: LinearSyntenyViewInit } {
  const anchor = features[0]
  if (!anchor) {
    throw new Error('No alignments to launch a synteny view on')
  }
  const resolved = features.map(feature => {
    const mate = getMate(feature)
    if (!mate) {
      throw new Error('Alignment has no mate to launch a synteny view against')
    }
    return { feature, mate, spans: resolveSpans({ feature, mate, region }) }
  })

  // Every panel is clipped to the same region of interest, so the anchor row
  // spans the union of what the individual alignments resolved to — one mate's
  // CIGAR can stop short of the region where another's covers it.
  const anchorStart = Math.min(...resolved.map(r => r.spans.featStart))
  const anchorEnd = Math.max(...resolved.map(r => r.spans.featEnd))

  const anchorView = {
    assembly: anchorAssembly,
    loc: paddedLocString({
      refName: anchor.get('refName'),
      start: anchorStart,
      end: anchorEnd,
      windowSize,
    }),
    // omitted rather than empty when there is nothing to carry over, so the
    // launched view's snapshot says "no tracks" the same way it always did
    ...(anchorTracks?.length ? { tracks: anchorTracks } : {}),
  }
  const mateViews = resolved.map(({ feature, mate, spans }) => ({
    assembly: mate.assemblyName,
    loc: paddedLocString({
      refName: mate.refName,
      start: spans.mateStart,
      end: spans.mateEnd,
      windowSize,
      reversed: flipReversedMates && feature.get('strand') === -1,
    }),
  }))

  return {
    init: {
      collapseEmptyRows: collapseEmptyRows ?? features.length > 1,
      views: [
        ...mateViews.slice(0, anchorIndex),
        anchorView,
        ...mateViews.slice(anchorIndex),
      ],
      // One synteny strip per gap between panels. The same track serves every
      // level: the view passes each level's two assemblies down to the adapter,
      // and an all-vs-all adapter resolves the pair from them.
      tracks: resolved.map(() => [trackId]),
    },
  }
}

export function launchSyntenyViewForFeatures({
  session,
  replacing,
  ...rest
}: BuildSyntenyViewSpecArgs & {
  session: AbstractSessionModel
  // the launching view, when the dialog's "Replace current view" was used
  replacing?: AbstractViewModel
}) {
  launchSyntenyView({
    session,
    viewType: 'LinearSyntenyView',
    replacing,
    ...buildSyntenyViewSpec(rest),
  })
}
