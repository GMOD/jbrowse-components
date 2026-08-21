import { buildSyntheticAssembly } from '@jbrowse/alignments-core'
import {
  assembleLocString,
  gatherOverlaps,
  getBpDisplayStr,
} from '@jbrowse/core/util'

import { buildSequenceTrack } from '../syntenyLaunchSequenceTrack.ts'

import type { SyntheticAssembly } from '@jbrowse/alignments-core'
import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

// "Linear read vs ref" for a reconstruction rather than a read. Same view, same
// synthetic-assembly trick, one axis swapped: the bottom panel is the
// DERIVATIVE PATH several reads agree on instead of the single read the user
// right-clicked, so every ribbon carries the support of its whole read group.
//
// The allele's SEQUENCE is not reconstructed here — that needs a consensus and
// a realignment (scripts/sv_multihop.py does it). Only its STRUCTURE is, which
// is all the ribbons draw: each segment is one alignment block joining a
// reference interval to its slot in derivative coordinates, and a reversed
// segment's block is twisted, which is what makes a foldback legible.

export interface DerivativeVsRefSpec {
  // A feature per segment, in derivative coordinates, named for the reference
  // interval it came from. Session-scoped like the temporary assembly it is
  // drawn against: the caller registers it with `addTrackConf` and then shows it
  // on the derivative panel, rather than it being named in `viewSpec`. See
  // `segmentsDisplay` for why it is mounted rather than declared.
  segmentsTrack: {
    type: 'FeatureTrack'
    trackId: string
    name: string
    assemblyNames: string[]
    adapter: {
      type: 'FromConfigAdapter'
      features: {
        uniqueId: string
        refName: string
        start: number
        end: number
        strand: number
        name: string
      }[]
    }
  }
  // The display snapshot `segmentsTrack` is shown with. Handed back for the
  // caller to pass to `showTrack` rather than written into `viewSpec.views[1]`,
  // because a display declared there attaches with the view: this track's
  // features come from its config rather than a fetch, so it lays out
  // immediately and reads the panel's width during its own `afterAttach`, before
  // React has measured the panel. Mounting it once the panel reports
  // `initialized` is the same picture without the race.
  segmentsDisplay: {
    type: 'LinearBasicDisplay'
    height: number
    configuration: {
      type: 'LinearBasicDisplay'
      displayId: string
      displayMode: string
    }
  }
  temporaryAssembly: SyntheticAssembly
  viewSpec: {
    type: 'LinearSyntenyView'
    displayName: string
    views: unknown[]
    tracks: unknown[]
  }
}

export interface BuildDerivativeVsRefArgs {
  candidate: DerivativeCandidate
  trackAssembly: string
  sequenceTrackConf: { trackId: string }
  // Reference-side padding around each segment, so a junction is not flush
  // against a panel edge. The candidate's own outer flank is already applied.
  windowSize?: number
  // Injected for testability. Production passes Date.now and Math.random.
  now: () => number
  rand: () => number
}

// chr3 → chr10 → chr12 → chr3 reads as one name; a path that revisits a
// chromosome should say so once rather than twice, so the label is built from
// the candidate's deduplicated refNames.
export function derivativeName(candidate: DerivativeCandidate) {
  return `der_${candidate.refNames.join('_')}`
}

// One line naming the path, for the picker. Orientation is spelled out rather
// than left to a `[rev]` suffix: this is the string a person reads to decide
// which candidate to look at, and "inverted" is what the event is called.
export function derivativePathLabel(candidate: DerivativeCandidate) {
  return candidate.segments
    .map(seg => `${seg.refName}${seg.strand === -1 ? ' (inverted)' : ''}`)
    .join(' → ')
}

/**
 * How a spec asks for one particular row of the picker, e.g.
 * `derivative-path-chr3-chr10-chr12rev-chr3rev`.
 *
 * Names the ROUTE rather than the row number, because rank is stable but not
 * meaningful: two routes tied on support are ordered by segment count, so at
 * COLO829's chr9 fold-back the two-segment allele the tutorial is about sits
 * under a three-segment one. A spec keyed on position silently captures the
 * wrong allele under the right caption.
 *
 * Every segment in derivative order with `rev` on the flipped ones, rather than
 * the deduplicated `refNames`. On that same fold-back `9 → 9 (inverted)` and
 * `9 → 9` are both two segments on one chromosome, so the deduplicated form
 * gave the two rows ONE id — the failure above, in the id meant to prevent it.
 *
 * Not `pathId`, which is opaque and carries coordinates: this one is read by a
 * person writing a spec. It is a locator, not an identity — for "which row did
 * the user pick", hold `pathId`. A shape can name more than one row, which is
 * why `selectedCandidateIndex` refuses to guess between them and why the DOM
 * gets these through {@link derivativePathTestIds} rather than one per row.
 */
export function derivativePathTestId(candidate: DerivativeCandidate) {
  return `derivative-path-${candidate.segments
    .map(seg => `${seg.refName}${seg.strand === -1 ? 'rev' : ''}`)
    .join('-')}`
}

/**
 * The same locators, made unique across one rendered list: the second and later
 * rows of a repeated shape take a `-2`, `-3` suffix.
 *
 * `derivativePathTestId` is a shape, and a shape is not unique: a candidate is
 * grouped by `pathId`, which is the clustered junction coordinates, so two
 * alleles crossing the same chromosomes in the same orientations at different
 * loci are two rows spelling one id. Repeated breakage-fusion-bridge cycles
 * re-breaking near one point are how that arises — `realReads.foldback` holds
 * two such alleles 28 bp apart, and they escape only because one picked up a
 * third segment. Emitted per row, the pair would give every `getByTestId` for
 * that shape "found multiple elements", in the id whose stated job is to keep a
 * spec off row numbers.
 *
 * Suffixed rather than respelled, so a spec naming a shape that turns out
 * unique still selects it, and the ambiguous case is at least reachable instead
 * of unusable. It names a ROW of one render either way: a spec wanting an
 * identity across renders holds `pathId`.
 *
 * The suffix skips past an id some other row already holds, because a shape
 * ending in a numeric refName can spell one: the tutorial's own assemblies name
 * chromosomes `9` and `2`, so a repeated `9 → 9 (inverted)` wants
 * `derivative-path-9-9rev-2`, which is already the bare shape of
 * `9 → 9 (inverted) → 2`. Suffixing blind reintroduces the duplicate it is here
 * to remove.
 */
export function derivativePathTestIds(candidates: DerivativeCandidate[]) {
  const shapes = candidates.map(derivativePathTestId)
  const taken = new Set(shapes)
  const seen = new Map<string, number>()
  return shapes.map(shape => {
    const nth = (seen.get(shape) ?? 0) + 1
    seen.set(shape, nth)
    if (nth === 1) {
      return shape
    }
    let n = nth
    while (taken.has(`${shape}-${n}`)) {
      n++
    }
    taken.add(`${shape}-${n}`)
    return `${shape}-${n}`
  })
}

/**
 * Which row a candidate the user picked earlier is now, or 0 when the list no
 * longer holds it.
 *
 * `pathId` first, which is the identity — but not an absolutely stable one, and
 * the picker is an observer over a list recomputed from whatever reads have
 * landed. The id carries clustered junction coordinates, and a cluster is
 * labelled by a coordinate some read supplied, so a route can be renamed
 * without its allele changing: the lookup misses and the radio drops back to
 * row 0 with the allele still sitting there, which is the bug holding a
 * `pathId` rather than a row index was meant to end.
 *
 * The route's SHAPE does not move with a coordinate, so it is the fallback —
 * and `derivativePathTestId` is already that shape, spelled for a spec to
 * select by. Taken only when it names exactly one row, because two routes of
 * the same shape at nearby loci are precisely the pair a fold-back produces and
 * guessing between them is how the wrong allele gets drawn under the right
 * caption.
 */
export function selectedCandidateIndex(
  candidates: DerivativeCandidate[],
  picked: DerivativeCandidate | undefined,
) {
  if (!picked) {
    return 0
  }
  const exact = candidates.findIndex(c => c.pathId === picked.pathId)
  if (exact !== -1) {
    return exact
  }
  const shape = derivativePathTestId(picked)
  const matches = candidates.filter(c => derivativePathTestId(c) === shape)
  return matches.length === 1 ? candidates.indexOf(matches[0]!) : 0
}

export function buildDerivativeVsRefSpec(
  args: BuildDerivativeVsRefArgs,
): DerivativeVsRefSpec {
  const {
    candidate,
    trackAssembly,
    sequenceTrackConf,
    windowSize = 1000,
    now,
    rand,
  } = args

  // Per-launch unique, so relaunching does not collide with the temporary
  // assembly a still-open view owns. `now()` alone is not that: it is
  // millisecond-resolution, and two candidates over the same chromosomes launched
  // inside one millisecond named one assembly — `addTemporaryAssembly` then warns
  // and hands back the FIRST, so the second view draws its own ribbons against an
  // axis the wrong `totalLength` long. The clock still leads, because a person
  // reading a session snapshot wants these in launch order.
  const stamp = `${now()}-${Math.floor(rand() * 1e6)}`
  const refName = derivativeName(candidate)
  const derivativeAssembly = `${refName}_${stamp}`
  const seqTrackId = `${refName}_seq_${stamp}`
  const syntenyTrackId = `derivative-${stamp}`
  const segmentsTrackId = `derivative-segments-${stamp}`

  // Segments are laid end to end in derivative coordinates, in path order. That
  // offset walk is the whole reconstruction: it is what turns a set of reference
  // intervals into one continuous allele.
  let offset = 0
  const features = candidate.segments.map((seg, idx) => {
    const length = seg.end - seg.start
    const mateStart = offset
    offset += length
    return {
      uniqueId: `${refName}-${idx}`,
      syntenyId: idx,
      refName: seg.refName,
      start: seg.start,
      end: seg.end,
      strand: seg.strand,
      // Every base of a segment is aligned: the path is built from alignment
      // blocks, so there is no indel to describe between the two sides.
      CIGAR: `${length}M`,
      mate: {
        uniqueId: `${refName}-${idx}-mate`,
        syntenyId: idx,
        refName,
        start: mateStart,
        end: mateStart + length,
      },
    }
  })
  const totalLength = offset

  // The same walk again, as a feature track on the derivative panel. Without it
  // that panel is an empty axis: the allele has no sequence and no annotation of
  // its own, so a reader gets a row of ribbons and nothing saying which
  // reference interval any of them is. Each segment is labelled with where it
  // came from, which is what turns the lower panel from a ruler into the
  // ribbons' legend, and it costs nothing extra to compute.
  const segmentFeatures = features.map((feat, idx) => ({
    uniqueId: `${refName}-${idx}-label`,
    refName,
    start: feat.mate.start,
    end: feat.mate.end,
    strand: feat.strand,
    name: `${assembleLocString({
      refName: feat.refName,
      start: feat.start,
      end: feat.end,
    })} (${getBpDisplayStr(feat.end - feat.start)}${
      // `inv`, not `inverted`: a label is drawn from its feature's own position,
      // and every segment after the first sits in the last few hundred bases of
      // the allele, so the ones that most need the marker are the ones with the
      // least room to the panel edge for it.
      feat.strand === -1 ? ', inv' : ''
    })`,
  }))

  const lgvRegions = gatherOverlaps(
    candidate.segments.map(seg => ({
      refName: seg.refName,
      start: Math.max(0, seg.start - windowSize),
      end: seg.end + windowSize,
      assemblyName: trackAssembly,
    })),
  )
  // Size the reference panel from the regions it actually draws, so the merging
  // and start-clamping gatherOverlaps applies is reflected exactly.
  const refLen = lgvRegions.reduce((a, r) => a + r.end - r.start, 0)

  return {
    segmentsTrack: {
      type: 'FeatureTrack',
      trackId: segmentsTrackId,
      name: 'Where each segment came from',
      assemblyNames: [derivativeAssembly],
      adapter: {
        type: 'FromConfigAdapter',
        features: segmentFeatures,
      },
    },
    segmentsDisplay: {
      type: 'LinearBasicDisplay',
      // One row per segment, and every segment gets its own: each label is far
      // wider than the feature under it, and the short segments of a path sit
      // within a few hundred bases of each other, so none of them can share a
      // row. Compact rows are what keeps all of them inside the space the
      // synteny view allows this panel.
      //
      // Capped, because segment count is not bounded by anything upstream: a
      // real ngmlr-aligned ONT record in COLO829 carries 943 SA entries, and a
      // path built from one would otherwise ask for a display tens of thousands
      // of pixels tall. Past the cap the track scrolls, which is the right
      // failure for a path no one can read anyway.
      height: Math.min(26 * candidate.segments.length + 30, 260),
      configuration: {
        type: 'LinearBasicDisplay',
        displayId: `${segmentsTrackId}-LinearBasicDisplay`,
        displayMode: 'compact',
      },
    },
    temporaryAssembly: buildSyntheticAssembly({
      refName,
      assemblyName: derivativeAssembly,
      // the assembly name is an id, and the stamp in it is only there so a
      // relaunch cannot collide with a still-open view's assembly. A panel
      // header shows the display name instead, so it does not show a wall-clock
      // timestamp.
      displayName: `${refName} derivative`,
      sequenceTrackName: 'Derivative allele',
      totalLength,
      // No bases: the path is a structure, not a consensus. Same case as a
      // hard-clipped read vs ref, and the sequence track renders as unavailable
      // rather than as wrong bases.
      seq: undefined,
      trackId: seqTrackId,
      uniqueId: `${refName}-seq`,
    }),
    viewSpec: {
      type: 'LinearSyntenyView',
      displayName: `${refName} (${candidate.readCount} reads) vs ${trackAssembly}`,
      views: [
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          windowWidthBp: refLen,
          displayedRegions: lgvRegions,
          tracks: [
            buildSequenceTrack(
              rand,
              [trackAssembly],
              sequenceTrackConf.trackId,
            ),
          ],
        },
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          windowWidthBp: totalLength,
          displayedRegions: [
            {
              assemblyName: derivativeAssembly,
              start: 0,
              end: totalLength,
              refName,
            },
          ],
          // The segments track is shown onto this panel afterwards, not declared
          // here — see `segmentsDisplay`.
          tracks: [],
        },
      ],
      tracks: [
        {
          type: 'SyntenyTrack',
          configuration: {
            type: 'SyntenyTrack',
            assemblyNames: [trackAssembly, derivativeAssembly],
            adapter: {
              type: 'FromConfigAdapter',
              // both sides of every alignment, so the lower panel can be drawn
              // against the upper one
              features: [...features, ...features.map(f => f.mate)],
            },
            trackId: syntenyTrackId,
            name: `${refName} vs ${trackAssembly}`,
          },
          displays: [
            {
              type: 'LinearSyntenyDisplay',
              // No `height` here: LinearSyntenyDisplay's is a getter reading the
              // view level's, so one written into this snapshot is silently
              // dead. The band is resized through the level (`setHeight`).
              configuration: `${syntenyTrackId}-LinearSyntenyDisplay`,
            },
          ],
        },
      ],
    },
  }
}
