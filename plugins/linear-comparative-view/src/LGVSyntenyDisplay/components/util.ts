import { parseCigar2 } from '@jbrowse/cigar-utils'
import { assembleLocString } from '@jbrowse/core/util'

import { findPosInCigar } from './findPosInCigar.ts'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

// The clicked block's genomic span, used to clip the launched synteny view to
// the region of interest. Only the span matters — the refName is the feature's
// by construction (the block is the one the feature was drawn in).
export interface RegionOfInterest {
  start: number
  end: number
}

// Synteny-feature `mate` shape. Feature.get returns `unknown` for this
// non-standard key, so the cast is centralized in one typed accessor rather
// than repeated (and drifting) at each call site. Mirrors the LinearSyntenyRPC
// SyntenyMate; `name`/`id` are only present when the source provides them.
export interface SyntenyMate {
  start: number
  end: number
  refName: string
  assemblyName: string
  name?: string
  id?: string
}

export function getMate(feature: Feature) {
  return feature.get('mate') as SyntenyMate
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

// The two spans the launched view opens on. With a region of interest and a
// CIGAR, both sides are narrowed to the visible slice of the alignment — the
// feature axis directly, the mate axis by walking the CIGAR — otherwise the
// whole block is used. Offsets past either end of the CIGAR are capped by
// findPosInCigar, and a region starting left of the feature yields a negative
// offset that breaks the walk immediately, so the result is always clipped to
// the block without needing an explicit intersection.
function resolveSpans({
  feature,
  region,
}: {
  feature: Feature
  region: RegionOfInterest | undefined
}) {
  const cigar = stringField(feature, 'CIGAR')
  const strand = feature.get('strand')
  const featStart = feature.get('start')
  const mate = getMate(feature)
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

// Pure snapshot builder for the launched synteny view, mirroring
// buildReadVsRefSpec — session mutation is the caller's (navToSynteny below), so
// the coordinate math is testable without a session.
export function buildSyntenyViewSpec({
  feature,
  windowSize,
  trackId,
  region,
  horizontallyFlip,
}: {
  windowSize: number
  trackId: string
  horizontallyFlip: boolean
  feature: Feature
  region?: RegionOfInterest
}) {
  const { featStart, featEnd, mateStart, mateEnd } = resolveSpans({
    feature,
    region,
  })
  const mate = getMate(feature)
  return {
    init: {
      views: [
        {
          assembly: stringField(feature, 'assemblyName'),
          loc: paddedLocString({
            refName: feature.get('refName'),
            start: featStart,
            end: featEnd,
            windowSize,
          }),
        },
        {
          assembly: mate.assemblyName,
          loc: paddedLocString({
            refName: mate.refName,
            start: mateStart,
            end: mateEnd,
            windowSize,
            reversed: horizontallyFlip,
          }),
        },
      ],
      tracks: [[trackId]],
    },
  }
}

export function navToSynteny({
  session,
  ...rest
}: {
  windowSize: number
  trackId: string
  horizontallyFlip: boolean
  feature: Feature
  session: AbstractSessionModel
  region?: RegionOfInterest
}) {
  session.addView('LinearSyntenyView', buildSyntenyViewSpec(rest))
}
