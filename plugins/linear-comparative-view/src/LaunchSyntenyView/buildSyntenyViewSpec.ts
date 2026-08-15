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

// One panel's worth of alignments, resolved onto both axes and unioned.
export interface ResolvedPanel {
  assemblyName: string
  refName: string
  // the slice of the anchor axis this panel's alignments cover
  anchorStart: number
  anchorEnd: number
  mateStart: number
  mateEnd: number
  // the strand the panel opens on, which is the one carrying most of the
  // alignment rather than whichever block happened to come first
  reversed: boolean
}

/**
 * Where one panel will open, before window padding — the same resolution the
 * launch itself runs, so the region dialog's panel list can preview the view it
 * is about to build instead of restating the whole block.
 *
 * ALL of the panel's alignments, unioned, not just the widest of them. A
 * selection routinely covers several blocks of one mate: an HSP table (BLAST
 * tabular) and a gene-anchor table (MCScan) are one row per *hit*, so a
 * kilobase-scale locus is already dozens of them, and even a minimap2 PAF splits
 * at every structural difference. Framing the panel on one of those blocks
 * opened a fraction of what the user selected, on both axes, and dropped the
 * rest with nothing on screen to say so.
 *
 * `undefined` when nothing in `features` has a mate, which is not a panel.
 */
export function resolvePanel(
  features: Feature[],
  region: RegionOfInterest | undefined,
): ResolvedPanel | undefined {
  const resolved = features.flatMap(feature => {
    const mate = getMate(feature)
    return mate
      ? [{ feature, mate, spans: resolveSpans({ feature, mate, region }) }]
      : []
  })
  // The mate refName carrying the most of the anchor axis. A selection can
  // reach two contigs of one mate assembly — a rearrangement, or simply a
  // fragmented assembly — and a panel opens on one stable sequence, so the
  // minority contig is dropped rather than unioned into a span covering
  // neither.
  const bpByRefName = new Map<string, number>()
  for (const { mate, spans } of resolved) {
    const bp = spans.featEnd - spans.featStart
    bpByRefName.set(mate.refName, (bpByRefName.get(mate.refName) ?? 0) + bp)
  }
  const refName = [...bpByRefName].sort((a, b) => b[1] - a[1])[0]?.[0]
  const kept = resolved.filter(r => r.mate.refName === refName)
  const first = kept[0]
  if (refName === undefined || !first) {
    return undefined
  }
  const minusBp = kept
    .filter(r => r.feature.get('strand') === -1)
    .reduce((a, r) => a + r.spans.featEnd - r.spans.featStart, 0)
  const totalBp = kept.reduce(
    (a, r) => a + r.spans.featEnd - r.spans.featStart,
    0,
  )
  // a reverse-strand walk counts down, so one block's two ends arrive swapped
  const mateEnds = kept.flatMap(r => [r.spans.mateStart, r.spans.mateEnd])
  return {
    assemblyName: first.mate.assemblyName,
    refName,
    anchorStart: Math.min(...kept.map(r => r.spans.featStart)),
    anchorEnd: Math.max(...kept.map(r => r.spans.featEnd)),
    mateStart: Math.floor(Math.min(...mateEnds)),
    mateEnd: Math.ceil(Math.max(...mateEnds)),
    // ties (a single zero-length block, an even split) read as forward, which
    // is what an unflipped panel already was
    reversed: minusBp * 2 > totalBp,
  }
}

/**
 * The mate side of a single alignment, for the callers that follow one block
 * rather than build a panel out of several — see `matePanelLocString`.
 */
export function resolvedMateSpan(
  feature: Feature,
  region: RegionOfInterest | undefined,
) {
  const panel = resolvePanel([feature], region)
  return panel
    ? {
        refName: panel.refName,
        start: panel.mateStart,
        end: panel.mateEnd,
        reversed: panel.reversed,
      }
    : undefined
}

// Pad a span by windowSize and render it as a locstring. assembleLocString is
// what makes this 1-based: navToLocString parses the result back as 1-based
// inclusive, so emitting the raw interbase start would open the view one base
// left of the alignment. The ends round OUTWARD — an interpolated mate span is
// fractional, and flooring its far end opened the view one base short of the
// span the dialog had just previewed. The `end` floor is raised to keep at
// least one base, since a zero-width span (windowSize 0 over a single-base
// CIGAR mapping) would assemble into an inverted locstring.
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
  const lo = Math.max(0, Math.floor(start - windowSize))
  return assembleLocString({
    refName,
    start: lo,
    end: Math.max(lo + 1, Math.ceil(end + windowSize)),
    reversed,
  })
}

export interface BuildSyntenyViewSpecArgs {
  // The alignments the launch is built from, all anchored on the same assembly
  // and refName. **One panel per mate assembly**, in the order each first
  // appears: a single feature is the pairwise launch, and the mates at one locus
  // of an all-vs-all track are the multi-way launch. Several alignments to the
  // same mate assembly are one panel spanning all of them, which is what a
  // selection over a fragmented alignment produces — see `resolvePanel`.
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

// One entry per launched panel, keyed by mate assembly and ordered by where
// each first appears — so the region dialog's row order survives the flatten it
// hands over, and the pairwise launch's single feature is a single panel.
function groupByMateAssembly(features: Feature[]) {
  const groups = new Map<string, Feature[]>()
  for (const feature of features) {
    const assemblyName = getMate(feature)?.assemblyName
    if (assemblyName !== undefined) {
      const group = groups.get(assemblyName)
      if (group) {
        group.push(feature)
      } else {
        groups.set(assemblyName, [feature])
      }
    }
  }
  return groups
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
  if (features.some(feature => !getMate(feature))) {
    throw new Error('Alignment has no mate to launch a synteny view against')
  }
  const panels = [...groupByMateAssembly(features).values()].map(group => {
    const panel = resolvePanel(group, region)
    if (!panel) {
      throw new Error('Alignment has no mate to launch a synteny view against')
    }
    return panel
  })

  // Every panel is clipped to the same region of interest, so the anchor row
  // spans the union of what the individual alignments resolved to — one mate's
  // CIGAR can stop short of the region where another's covers it.
  const anchorStart = Math.min(...panels.map(p => p.anchorStart))
  const anchorEnd = Math.max(...panels.map(p => p.anchorEnd))

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
  const mateViews = panels.map(panel => ({
    assembly: panel.assemblyName,
    loc: paddedLocString({
      refName: panel.refName,
      start: panel.mateStart,
      end: panel.mateEnd,
      windowSize,
      reversed: flipReversedMates && panel.reversed,
    }),
  }))

  return {
    init: {
      collapseEmptyRows: collapseEmptyRows ?? panels.length > 1,
      views: [
        ...mateViews.slice(0, anchorIndex),
        anchorView,
        ...mateViews.slice(anchorIndex),
      ],
      // One synteny strip per gap between panels. The same track serves every
      // level: the view passes each level's two assemblies down to the adapter,
      // and an all-vs-all adapter resolves the pair from them.
      tracks: panels.map(() => [trackId]),
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
