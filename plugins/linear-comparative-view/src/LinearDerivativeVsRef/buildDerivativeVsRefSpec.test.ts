import {
  buildDerivativeVsRefSpec,
  derivativeName,
} from './buildDerivativeVsRefSpec.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

// The COLO829 der(3) path: two chr3 arms in opposite orientations with short
// pieces of chr10 and chr12 spliced in at the turn.
const CANDIDATE: DerivativeCandidate = {
  segments: [
    { refName: 'chr3', start: 25_326_821, end: 25_359_568, strand: 1 },
    { refName: 'chr10', start: 58_717_463, end: 58_717_662, strand: 1 },
    { refName: 'chr12', start: 72_273_111, end: 72_273_294, strand: -1 },
    { refName: 'chr3', start: 25_352_683, end: 25_359_111, strand: -1 },
  ],
  readCount: 29,
  locString: '',
  refNames: ['chr3', 'chr10', 'chr12'],
  extendsOffScreen: false,
}

function build(candidate = CANDIDATE) {
  let n = 0
  return buildDerivativeVsRefSpec({
    candidate,
    trackAssembly: 'hg38',
    viewWidth: 1000,
    sequenceTrackConf: { trackId: 'hg38-ReferenceSequenceTrack' },
    now: () => 1234,
    rand: () => ++n,
  })
}

describe('buildDerivativeVsRefSpec', () => {
  it('lays the segments end to end in derivative coordinates', () => {
    const { viewSpec } = build()
    const track = viewSpec.viewTrackConfigs[0] as {
      adapter: { features: { mate?: { start: number; end: number } }[] }
    }
    // the first half of the feature store is the reference side, each carrying
    // its mate; the mates tile [0, totalLength) with no gap and no overlap
    const mates = track.adapter.features
      .map(f => f.mate)
      .filter(m => m !== undefined)
    expect(mates.map(m => [m.start, m.end])).toEqual([
      [0, 32_747],
      [32_747, 32_946],
      [32_946, 33_129],
      [33_129, 39_557],
    ])
  })

  it('carries each segment’s orientation onto its ribbon', () => {
    const { viewSpec } = build()
    const track = viewSpec.viewTrackConfigs[0] as {
      adapter: { features: { strand?: number }[] }
    }
    expect(track.adapter.features.slice(0, 4).map(f => f.strand)).toEqual([
      1, 1, -1, -1,
    ])
  })

  it('sizes the derivative panel to the summed segment lengths', () => {
    const { viewSpec, temporaryAssembly } = build()
    const total = CANDIDATE.segments.reduce(
      (sum, seg) => sum + (seg.end - seg.start),
      0,
    )
    const derivativeView = viewSpec.views[1] as {
      displayedRegions: { start: number; end: number; refName: string }[]
      bpPerPx: number
    }
    expect(derivativeView.displayedRegions[0]!.end).toBe(total)
    expect(derivativeView.bpPerPx).toBe(total / 1000)
    expect(temporaryAssembly.sequence.adapter.features[0]!.end).toBe(total)
  })

  it('gives the reference panel one region per locus, padded', () => {
    const { viewSpec } = build()
    const refView = viewSpec.views[0] as {
      displayedRegions: { refName: string; start: number; end: number }[]
    }
    // the two chr3 segments overlap, so gatherOverlaps merges them into one
    // reference window; chr10 and chr12 stay separate
    expect(refView.displayedRegions.map(r => r.refName)).toEqual([
      'chr3',
      'chr10',
      'chr12',
    ])
    const chr10 = refView.displayedRegions[1]!
    expect(chr10.start).toBe(58_717_463 - 1000)
    expect(chr10.end).toBe(58_717_662 + 1000)
  })

  it('registers a temporary assembly the synteny track names on both sides', () => {
    const { viewSpec, temporaryAssembly } = build()
    const track = viewSpec.viewTrackConfigs[0] as { assemblyNames: string[] }
    expect(track.assemblyNames).toEqual(['hg38', temporaryAssembly.name])
    expect(temporaryAssembly.sequence.assemblyNames).toEqual([
      temporaryAssembly.name,
    ])
  })

  it('ships only the sequence track in the snapshot', () => {
    // The caller's own tracks are added afterwards via `showTrack`, not written
    // here: a hand-built `{ type, configuration }` entry has no `displays` and
    // draws nothing. Guarding the snapshot keeps that decision from quietly
    // reverting into a shape that mounts empty tracks.
    const refView = build().viewSpec.views[0] as {
      tracks: { configuration: unknown }[]
    }
    expect(refView.tracks.map(t => t.configuration)).toEqual([
      'hg38-ReferenceSequenceTrack',
    ])
  })

  it('leaves the derivative panel empty: no configured track names it', () => {
    const derivativeView = build().viewSpec.views[1] as { tracks: unknown[] }
    expect(derivativeView.tracks).toEqual([])
  })

  it('carries no bases: the path is a structure, not a consensus', () => {
    const { temporaryAssembly } = build()
    expect(temporaryAssembly.sequence.adapter.features[0]!.seq).toBe('')
  })

  it('names a revisited chromosome once and puts the support in the title', () => {
    expect(derivativeName(CANDIDATE)).toBe('der_chr3_chr10_chr12')
    expect(build().viewSpec.displayName).toBe(
      'der_chr3_chr10_chr12 (29 reads) vs hg38',
    )
  })

  it('does not collide with a still-open view built from the same path', () => {
    let stamp = 1
    const spec = () =>
      buildDerivativeVsRefSpec({
        candidate: CANDIDATE,
        trackAssembly: 'hg38',
        viewWidth: 1000,
        sequenceTrackConf: { trackId: 'hg38-ReferenceSequenceTrack' },
        now: () => stamp++,
        rand: () => 0,
      })
    expect(spec().temporaryAssembly.name).not.toBe(
      spec().temporaryAssembly.name,
    )
  })
})
