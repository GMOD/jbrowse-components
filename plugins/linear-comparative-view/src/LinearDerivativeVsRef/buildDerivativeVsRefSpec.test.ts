import {
  buildDerivativeVsRefSpec,
  derivativeName,
  derivativePathTestIds,
  selectedCandidateIndex,
} from './buildDerivativeVsRefSpec.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

// The synthesized config rides on the track that draws it rather than in any
// session or view-level list, so it goes out with the view.
function syntenyConf(viewSpec: { tracks: unknown[] }) {
  return (viewSpec.tracks[0] as { configuration: unknown }).configuration
}

// The COLO829 der(3) path: two chr3 arms in opposite orientations with short
// pieces of chr10 and chr12 spliced in at the turn.
const CANDIDATE_SEGMENTS = [
  { refName: 'chr3', start: 25_326_821, end: 25_359_568, strand: 1 },
  { refName: 'chr10', start: 58_717_463, end: 58_717_662, strand: 1 },
  { refName: 'chr12', start: 72_273_111, end: 72_273_294, strand: -1 },
  { refName: 'chr3', start: 25_352_683, end: 25_359_111, strand: -1 },
]

// No flank modelled: this builder reads `segments`, and the spans above are
// written as the ones the drawing should carry.
const CANDIDATE: DerivativeCandidate = {
  segments: CANDIDATE_SEGMENTS,
  observedSegments: CANDIDATE_SEGMENTS,
  readCount: 29,
  pathId: 'der3',
  locString: '',
  refNames: ['chr3', 'chr10', 'chr12'],
  extendsOffScreen: false,
}

function build(candidate = CANDIDATE) {
  let n = 0
  return buildDerivativeVsRefSpec({
    candidate,
    trackAssembly: 'hg38',
    sequenceTrackConf: { trackId: 'hg38-ReferenceSequenceTrack' },
    now: () => 1234,
    rand: () => ++n,
  })
}

describe('buildDerivativeVsRefSpec', () => {
  it('lays the segments end to end in derivative coordinates', () => {
    const { viewSpec } = build()
    const track = syntenyConf(viewSpec) as {
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
    const track = syntenyConf(viewSpec) as {
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
      windowWidthBp: number
    }
    expect(derivativeView.displayedRegions[0]!.end).toBe(total)
    // the panel frames the whole derivative, said as the span it frames rather
    // than as a scale against a width the builder had to be told
    expect(derivativeView.windowWidthBp).toBe(total)
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
    const track = syntenyConf(viewSpec) as { assemblyNames: string[] }
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

  it('hands the segments track back to be shown, not declared in the snapshot', () => {
    // A display named in `views[1]` attaches with the view, i.e. before React
    // has measured it, and this track lays out the instant it attaches because
    // its features come from its own config. The caller shows it once the panel
    // reports a width instead. Guarding the snapshot keeps that from quietly
    // reverting.
    const { viewSpec, segmentsTrack, segmentsDisplay } = build()
    expect((viewSpec.views[1] as { tracks: unknown[] }).tracks).toEqual([])
    expect(segmentsDisplay.configuration.displayId).toBe(
      `${segmentsTrack.trackId}-LinearBasicDisplay`,
    )
  })

  it('sizes the labels to one compact row per segment', () => {
    // Every segment lands on its own row: each label is far wider than the
    // feature under it, and a path's short segments sit within a few hundred
    // bases of each other. Undersizing this clips the last of them, which are
    // the interesting ones.
    const { segmentsDisplay } = build()
    expect(segmentsDisplay.configuration.displayMode).toBe('compact')
    expect(segmentsDisplay.height).toBe(26 * 4 + 30)
    const twoHop = build({
      ...CANDIDATE,
      segments: CANDIDATE.segments.slice(0, 2),
    })
    expect(twoHop.segmentsDisplay.height).toBe(26 * 2 + 30)
  })

  it('caps the label track for a path no one could read', () => {
    // Segment count has no upper bound upstream: an ngmlr-aligned ONT record in
    // COLO829 carries 943 SA entries, and one segment per row would ask for a
    // display tens of thousands of pixels tall.
    const huge = build({
      ...CANDIDATE,
      segments: Array.from({ length: 900 }, (_, i) => ({
        refName: 'chr1',
        start: i * 1000,
        end: i * 1000 + 500,
        strand: 1,
      })),
    })
    expect(huge.segmentsDisplay.height).toBe(260)
  })

  it('names each label with its letters and reference interval, marking the inverted ones', () => {
    const { segmentsTrack } = build()
    // the first arm carries three pieces because the returning arm's edges cut
    // it, which is what lets a reader see B twice
    expect(segmentsTrack.adapter.features.map(f => f.name)).toEqual([
      'ABC · chr3:25,326,822..25,359,568 (32.7Kbp)',
      'D · chr10:58,717,464..58,717,662 (199bp)',
      'E′ · chr12:72,273,112..72,273,294 (183bp, inv)',
      'B′ · chr3:25,352,684..25,359,111 (6.43Kbp, inv)',
    ])
  })

  it('places the labels in derivative coordinates, not reference ones', () => {
    // Same tiling as the ribbons' mates: the labels sit under the segments they
    // name, so a label that kept its reference start would land in a different
    // part of the allele (or off it).
    const { viewSpec, segmentsTrack } = build()
    const synteny = syntenyConf(viewSpec) as {
      adapter: { features: { mate?: { start: number; end: number } }[] }
    }
    const mates = synteny.adapter.features
      .map(f => f.mate)
      .filter(m => m !== undefined)
    expect(segmentsTrack.adapter.features.map(f => [f.start, f.end])).toEqual(
      mates.map(m => [m.start, m.end]),
    )
  })

  it('scopes the labels to the temporary assembly it just built', () => {
    const { segmentsTrack, temporaryAssembly } = build()
    expect(segmentsTrack.assemblyNames).toEqual([temporaryAssembly.name])
    expect(segmentsTrack.adapter.features[0]!.refName).toBe(
      derivativeName(CANDIDATE),
    )
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
        sequenceTrackConf: { trackId: 'hg38-ReferenceSequenceTrack' },
        now: () => stamp++,
        rand: () => 0,
      })
    expect(spec().temporaryAssembly.name).not.toBe(
      spec().temporaryAssembly.name,
    )
  })
})

// The picker is an observer over a list recomputed from whatever reads have
// landed, so the row a user clicked has to be found again in a list they did
// not see built.
describe('selectedCandidateIndex', () => {
  const other: DerivativeCandidate = {
    ...CANDIDATE,
    segments: [
      { refName: 'chr7', start: 1000, end: 2000, strand: 1 },
      { refName: 'chr9', start: 5000, end: 6000, strand: 1 },
    ],
    pathId: 'other',
    refNames: ['chr7', 'chr9'],
  }

  it('falls back to the first row when nothing is picked yet', () => {
    expect(selectedCandidateIndex([other, CANDIDATE], undefined)).toBe(0)
  })

  it('finds the picked route by its id', () => {
    expect(selectedCandidateIndex([other, CANDIDATE], CANDIDATE)).toBe(1)
  })

  it('holds the route when a later read relabels its junction cluster', () => {
    // Same allele, same shape, a `pathId` that moved: a cluster is labelled by
    // the lowest endpoint any read placed it at, so a read arriving to the left
    // of the group the user already picked renames it. Matching on the id alone
    // dropped the selection back to row 0 with the allele still on screen.
    const relabelled = { ...CANDIDATE, pathId: 'der3-shifted' }
    expect(selectedCandidateIndex([other, relabelled], CANDIDATE)).toBe(1)
  })

  it('refuses to guess between two routes of the same shape', () => {
    // Two visits to one chromosome in the same orientations is what a fold-back
    // locus produces; picking either would draw the wrong allele under the right
    // caption, so an id that no longer matches falls back to row 0 instead.
    const twin = { ...CANDIDATE, pathId: 'twin' }
    const alsoTwin = { ...CANDIDATE, pathId: 'also-twin' }
    expect(
      selectedCandidateIndex([other, twin, alsoTwin], {
        ...CANDIDATE,
        pathId: 'gone',
      }),
    ).toBe(0)
  })
})

// A shape is not unique, and `derivativePathTestId`'s own docstring says so: a
// candidate is grouped by clustered junction coordinates, so two alleles
// crossing the same chromosomes in the same orientations at different loci are
// two rows spelling one id. Emitted per row, both would carry the same
// `data-testid` and every `getByTestId` for it would throw "found multiple
// elements".
describe('derivativePathTestIds', () => {
  const foldback = (start: number): DerivativeCandidate => {
    const segments = [
      { refName: 'chr9', start, end: start + 1837, strand: 1 },
      {
        refName: 'chr9',
        start: start + 29_142,
        end: start + 31_000,
        strand: -1,
      },
    ]
    return {
      segments,
      observedSegments: segments,
      readCount: 4,
      pathId: `foldback-${start}`,
      locString: '',
      refNames: ['chr9'],
      extendsOffScreen: false,
    }
  }

  it('suffixes the later rows of a repeated shape', () => {
    expect(
      derivativePathTestIds([foldback(28_030_000), foldback(28_400_000)]),
    ).toEqual([
      'derivative-path-chr9-chr9rev',
      'derivative-path-chr9-chr9rev-2',
    ])
  })

  it('names every row exactly once', () => {
    const ids = derivativePathTestIds([
      foldback(1),
      CANDIDATE,
      foldback(2),
      foldback(3),
    ])
    expect(new Set(ids).size).toBe(ids.length)
  })

  // A spec naming a shape that turns out unique still selects it, so making the
  // ambiguous case reachable did not respell the common one.
  it('leaves an unrepeated shape as the bare locator', () => {
    expect(derivativePathTestIds([CANDIDATE])).toEqual([
      'derivative-path-chr3-chr10-chr12rev-chr3rev',
    ])
  })

  // The suffix is spelled out of the same alphabet the shape is, so on an
  // Ensembl-named assembly — which is what the tutorial's own specs select
  // against, `derivative-path-9-9rev` — a blind `-2` collides with the bare
  // shape of the route that visits chromosome 2 next.
  it('does not suffix onto an id another row already holds', () => {
    const seg = (refName: string, strand = 1) => ({
      refName,
      start: 0,
      end: 1000,
      strand,
    })
    const route = (segments: ReturnType<typeof seg>[], id: string) =>
      ({
        segments,
        readCount: 4,
        pathId: id,
        locString: '',
        refNames: [...new Set(segments.map(s => s.refName))],
        extendsOffScreen: false,
      }) as DerivativeCandidate
    const ids = derivativePathTestIds([
      route([seg('9'), seg('9', -1)], 'a'),
      route([seg('9'), seg('9', -1)], 'b'),
      route([seg('9'), seg('9', -1), seg('2')], 'c'),
    ])
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('derivative-path-9-9rev')
    expect(ids[2]).toBe('derivative-path-9-9rev-2')
  })
})

// `now()` is millisecond-resolution, so two candidates over the same chromosomes
// launched inside one millisecond named ONE temporary assembly:
// `addTemporaryAssembly` warns and hands back the first, and the second view
// draws its ribbons against an axis the wrong `totalLength` long.
it('two launches in the same millisecond do not name one assembly', () => {
  const at = (rand: () => number) =>
    buildDerivativeVsRefSpec({
      candidate: CANDIDATE,
      trackAssembly: 'hg38',
      sequenceTrackConf: { trackId: 'hg38-ReferenceSequenceTrack' },
      now: () => 1234,
      rand,
    }).temporaryAssembly.name
  expect(at(() => 0.25)).not.toBe(at(() => 0.75))
})
