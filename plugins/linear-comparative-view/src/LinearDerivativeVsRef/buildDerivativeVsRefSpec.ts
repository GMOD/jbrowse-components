import { gatherOverlaps } from '@jbrowse/core/util'

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
  temporaryAssembly: {
    name: string
    sequence: {
      type: 'ReferenceSequenceTrack'
      name: string
      trackId: string
      assemblyNames: string[]
      adapter: {
        type: 'FromConfigSequenceAdapter'
        noAssemblyManager: true
        features: {
          start: number
          end: number
          seq: string
          refName: string
          uniqueId: string
        }[]
      }
    }
  }
  viewSpec: {
    type: 'LinearSyntenyView'
    displayName: string
    views: unknown[]
    viewTrackConfigs: unknown[]
    tracks: unknown[]
  }
}

export interface BuildDerivativeVsRefArgs {
  candidate: DerivativeCandidate
  trackAssembly: string
  viewWidth: number
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

export function buildDerivativeVsRefSpec(
  args: BuildDerivativeVsRefArgs,
): DerivativeVsRefSpec {
  const {
    candidate,
    trackAssembly,
    viewWidth,
    sequenceTrackConf,
    windowSize = 1000,
    now,
    rand,
  } = args

  const stamp = now()
  const refName = derivativeName(candidate)
  // per-launch unique, so relaunching does not collide with the temporary
  // assembly a still-open view owns
  const derivativeAssembly = `${refName}_${stamp}`
  const seqTrackId = `${refName}_seq_${stamp}`
  const syntenyTrackId = `derivative-${stamp}`

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
    temporaryAssembly: {
      name: derivativeAssembly,
      sequence: {
        type: 'ReferenceSequenceTrack',
        name: 'Derivative allele',
        trackId: seqTrackId,
        assemblyNames: [derivativeAssembly],
        adapter: {
          type: 'FromConfigSequenceAdapter',
          noAssemblyManager: true,
          // No bases: the path is a structure, not a consensus. An empty seq is
          // the same case a hard-clipped read vs ref already produces, and the
          // sequence track renders as unavailable rather than as wrong bases.
          features: [
            {
              start: 0,
              end: totalLength,
              seq: '',
              refName,
              uniqueId: `${refName}-seq`,
            },
          ],
        },
      },
    },
    viewSpec: {
      type: 'LinearSyntenyView',
      displayName: `${refName} (${candidate.readCount} reads) vs ${trackAssembly}`,
      views: [
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          offsetPx: 0,
          bpPerPx: refLen / viewWidth,
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
          offsetPx: 0,
          bpPerPx: totalLength / viewWidth,
          displayedRegions: [
            {
              assemblyName: derivativeAssembly,
              start: 0,
              end: totalLength,
              refName,
            },
          ],
          tracks: [],
        },
      ],
      viewTrackConfigs: [
        {
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
      ],
      tracks: [
        {
          configuration: syntenyTrackId,
          type: 'SyntenyTrack',
          displays: [
            {
              type: 'LinearSyntenyDisplay',
              configuration: `${syntenyTrackId}-LinearSyntenyDisplay`,
            },
          ],
        },
      ],
    },
  }
}

function buildSequenceTrack(
  rand: () => number,
  assemblyNames: string[] | undefined,
  trackId: string,
) {
  return {
    id: `${rand()}`,
    type: 'ReferenceSequenceTrack',
    ...(assemblyNames ? { assemblyNames } : {}),
    configuration: trackId,
    displays: [
      {
        id: `${rand()}`,
        type: 'LinearReferenceSequenceDisplay',
        height: 35,
        configuration: {
          type: 'LinearReferenceSequenceDisplay',
          displayId: `${trackId}-LinearReferenceSequenceDisplay`,
          showReverse: false,
          showTranslation: false,
        },
      },
    ],
  }
}
