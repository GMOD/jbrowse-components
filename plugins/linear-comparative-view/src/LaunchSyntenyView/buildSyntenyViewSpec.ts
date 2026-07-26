import { parseCigar2 } from '@jbrowse/cigar-utils'
import { assembleLocString } from '@jbrowse/core/util'
import { launchSyntenyView } from '@jbrowse/synteny-core'

import { getMate } from '../syntenyMate.ts'
import { findPosInCigar } from './findPosInCigar.ts'

import type { LinearSyntenyViewInit } from '../LinearSyntenyView/types.ts'
import type { SyntenyMate } from '../syntenyMate.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

// The clicked block's genomic span, used to clip the launched synteny view to
// the region of interest. Only the span matters — the refName is the feature's
// by construction (the block is the one the feature was drawn in).
export interface RegionOfInterest {
  start: number
  end: number
}

// Feature.get types the non-standard keys as `unknown`; narrow rather than cast.
function stringField(feature: Feature, key: string) {
  const val = feature.get(key)
  return typeof val === 'string' ? val : undefined
}

// A synteny view can be launched against any assembly the track spans, i.e. one
// of the track's declared assemblyNames. This is static config, so it holds
// whether or not the assembly is loaded yet — an unloaded one resolves on demand
// (e.g. via a connection) when the view opens. A one-vs-all mate that is only a
// PanSN sample label rather than a listed assembly is absent from assemblyNames,
// so the launch option stays hidden for it.
export function canLaunchSyntenyForMate(
  trackAssemblyNames: string[],
  mateAssembly: string | undefined,
) {
  return mateAssembly !== undefined && trackAssemblyNames.includes(mateAssembly)
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
// matching slice of its mate. With a region of interest and a CIGAR, both sides
// are narrowed to the visible slice of the alignment — the feature axis
// directly, the mate axis by walking the CIGAR — otherwise the whole block is
// used. Offsets past either end of the CIGAR are capped by findPosInCigar, and a
// region starting left of the feature yields a negative offset that breaks the
// walk immediately, so the result is always clipped to the block without needing
// an explicit intersection.
function resolveSpans({
  feature,
  mate,
  region,
}: {
  feature: Feature
  mate: SyntenyMate
  region: RegionOfInterest | undefined
}) {
  const cigar = stringField(feature, 'CIGAR')
  const strand = feature.get('strand')
  const featStart = feature.get('start')
  let spans: {
    featStart: number
    featEnd: number
    mateStart: number
    mateEnd: number
  }
  if (region && cigar) {
    const p = parseCigar2(cigar)
    const [fStartX, mStartX] = findPosInCigar(p, region.start - featStart)
    const [fEndX, mEndX] = findPosInCigar(p, region.end - featStart)
    spans = {
      featStart: featStart + fStartX,
      featEnd: featStart + fEndX,
      mateStart: mateOffsetToGenomic(mate, mStartX, strand),
      mateEnd: mateOffsetToGenomic(mate, mEndX, strand),
    }
  } else {
    spans = {
      featStart,
      featEnd: feature.get('end'),
      mateStart: mate.start,
      mateEnd: mate.end,
    }
  }
  return spans
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
  // own default: a multi-way launch collapses (a launch gives no panel any
  // tracks, so on a stack the per-row "No tracks active" block is the tallest
  // thing in the view), a pairwise one does not, since two rows have the room.
  // The dialog's checkbox passes it explicitly either way.
  collapseEmptyRows?: boolean
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
  ...rest
}: BuildSyntenyViewSpecArgs & {
  session: AbstractSessionModel
}) {
  launchSyntenyView({
    session,
    viewType: 'LinearSyntenyView',
    ...buildSyntenyViewSpec(rest),
  })
}
