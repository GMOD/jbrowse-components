import {
  assembleLocString,
  gatherOverlaps,
  getBpDisplayStr,
} from '@jbrowse/core/util'
import { derivativeOffsets } from '@jbrowse/plugin-alignments'

import type {
  DerivativeCandidate,
  ProjectedRead,
} from '@jbrowse/plugin-alignments'

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

// A read consistent with the allele over its whole length, and one that leaves
// it. Blue against orange rather than green against red: the second read is not
// an error — the interesting ones in COLO829 are three reads that skip the
// templated insert the reconstruction claims — and a red/green pair both says
// "bad" and is the one pair a red-green colorblind reader cannot separate.
const FOLLOWS_COLOR = '#4472a8'
const BREAKS_COLOR = '#e07b39'

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
  // The reads placed on the allele, in derivative coordinates, one feature per
  // read with one subfeature per placed piece. Undefined when no read in view
  // touches the path — which is possible: a candidate can be built entirely from
  // SA tags naming loci no displayed region covers.
  //
  // Shown the same way as `segmentsTrack`, and for the same reason.
  readsTrack?: {
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
        type: string
        followsPath: boolean
        largestBreak: number
        segmentsOffPath: number
        subfeatures: {
          uniqueId: string
          refName: string
          start: number
          end: number
          strand: number
          type: string
          source: string
          followsPath: boolean
        }[]
      }[]
    }
  }
  readsDisplay?: {
    type: 'LinearBasicDisplay'
    height: number
    configuration: {
      type: 'LinearBasicDisplay'
      displayId: string
      displayMode: string
      color: string
      showLabels: string
    }
  }
  temporaryAssembly: {
    name: string
    displayName: string
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
  // The reads in view placed on this candidate's axis
  // (`projectReadsOntoDerivative`). Optional: without them the reconstruction is
  // the same picture minus the evidence panel.
  projectedReads?: ProjectedRead[]
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
    projectedReads = [],
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
  const segmentsTrackId = `derivative-segments-${stamp}`
  const readsTrackId = `derivative-reads-${stamp}`

  // Segments are laid end to end in derivative coordinates, in path order. That
  // offset walk is the whole reconstruction: it is what turns a set of reference
  // intervals into one continuous allele. `derivativeOffsets` rather than a
  // local accumulator because the reads are placed on the axis it defines, and
  // two spellings of one walk put a read somewhere other than the ribbon it
  // belongs to without either side looking wrong on its own.
  const offsets = derivativeOffsets(candidate.segments)
  const features = candidate.segments.map((seg, idx) => {
    const length = seg.end - seg.start
    const mateStart = offsets[idx]!
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
  const totalLength = offsets[candidate.segments.length]!

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

  // The reads, on the same axis. One feature per read, one subfeature per piece
  // of it the path accounts for — so a read that follows the allele draws as an
  // unbroken bar and one that leaves it draws as boxes with a connector across
  // the jump. That break is the only thing in the view that can disagree with
  // the reconstruction: the ribbons are built FROM these reads, so they always
  // agree with them.
  const readFeatures = projectedReads.map((read, idx) => ({
    uniqueId: `${refName}-read-${idx}`,
    refName,
    start: read.start,
    end: read.end,
    strand: read.strand,
    name: read.readName,
    type: 'read',
    // Read back by the display's `color` callback below, and shown in the
    // feature detail panel — where `largestBreak` is the number behind the
    // color, since "this read leaves the allele by 8 kb" and "by 200 bp" are
    // different claims and the fill alone cannot say which.
    followsPath: read.followsPath,
    largestBreak: read.maxGap,
    segmentsOffPath: read.unplacedCount,
    subfeatures: read.pieces.map((piece, pieceIdx) => ({
      uniqueId: `${refName}-read-${idx}-${pieceIdx}`,
      refName,
      start: piece.start,
      end: piece.end,
      strand: piece.strand,
      type: 'match',
      // where this piece of the read actually aligned, so a click on a broken
      // read says which locus each surviving piece came from
      source: assembleLocString({
        refName: piece.refName,
        start: piece.refStart,
        end: piece.refEnd,
      }),
      // The boxes are what get painted, and each resolves its own color, so the
      // flag has to ride on them too — a callback reading it off the parent
      // paints every piece of every read the same.
      followsPath: read.followsPath,
    })),
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
    ...(readFeatures.length > 0
      ? {
          readsTrack: {
            type: 'FeatureTrack' as const,
            trackId: readsTrackId,
            name: `Reads on this allele (${
              readFeatures.filter(read => read.followsPath).length
            }/${readFeatures.length} unbroken)`,
            assemblyNames: [derivativeAssembly],
            adapter: {
              type: 'FromConfigAdapter' as const,
              features: readFeatures,
            },
          },
          readsDisplay: {
            type: 'LinearBasicDisplay' as const,
            // Deep enough to see the pileup is a pileup, capped well under the
            // segment labels' share of the panel: this is the evidence, the
            // labels are the legend, and a hundred-read window must not push the
            // legend off the panel. Past the cap it scrolls.
            //
            // Sized in compact rows (0.6 of a normal one), which is what this
            // panel is worth: the claim it makes is about the whole read set —
            // how many agree and how many break — so a mode showing nine of
            // thirty-eight reads makes it at a scale that cannot say it.
            height: Math.min(9 * readFeatures.length + 20, 180),
            configuration: {
              type: 'LinearBasicDisplay' as const,
              displayId: `${readsTrackId}-LinearBasicDisplay`,
              displayMode: 'compact',
              // The whole point of the panel in one slot: a read consistent with
              // the allele over its whole length against one that is not. Read
              // off the feature rather than from a per-feature color, so the
              // rule is legible in the config and a reader can change it.
              color: `jexl:get(feature,'followsPath')?'${FOLLOWS_COLOR}':'${BREAKS_COLOR}'`,
              // 36-character UUIDs on an ONT read set, one per row, over
              // features that are mostly narrower than their own name. The name
              // is a click away in the feature detail panel.
              showLabels: 'none',
            },
          },
        }
      : {}),
    temporaryAssembly: {
      name: derivativeAssembly,
      // the name above is an id, and the stamp in it is only there so a relaunch
      // cannot collide with a still-open view's assembly. A panel header shows
      // the display name instead, so it does not show a wall-clock timestamp.
      displayName: `${refName} derivative`,
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
          // The segments track is shown onto this panel afterwards, not declared
          // here — see `segmentsDisplay`.
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
