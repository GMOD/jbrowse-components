import { SimpleFeature } from '@jbrowse/core/util'

import { resolvePanel } from '../LaunchSyntenyView/resolvePanel.ts'
import {
  alignRowFrames,
  computeRowFrame,
  frameSpan,
  frameTickXs,
  laneFetchRegion,
  laneFetchWindow,
  geneGlyphShape,
  groupFeatures,
  groupSpansOnRow,
  laneGeneFeatures,
  laneGeometry,
  rowAssembliesOf,
  rowFrameX,
  tickIntervalFor,
} from './layoutMultiWay.ts'

function pairFeature({
  uniqueId,
  name,
  start,
  end,
  strand = 1,
  mate,
}: {
  uniqueId: string
  name: string
  start: number
  end: number
  strand?: number
  mate: {
    assemblyName: string
    refName: string
    start: number
    end: number
    name: string
  }
}) {
  // No `strand` inside `mate`: the PAF adapters never write one, and the
  // MCScan blocks adapter writes the mate gene's TRANSCRIPTION strand there.
  // The pair's orientation is the feature's own top-level `strand`, which both
  // adapters do emit — so that is the only one a fixture may state.
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end,
    strand,
    name,
    assemblyName: 'anchor',
    mate,
  })
}

// The seed `alignRowFrames` takes: where the anchor lane actually draws each
// group, in canvas px. The model builds it from the view's own `bpToPx`; these
// tests build it from a linear map over `spanBp`, which is what the hand-built
// anchor `RowFrame` they used to pass was standing in for. Written as a
// function of the anchor coordinates so a test can say what the anchor lane
// shows without owning a frame for it.
function anchorSeed(
  groups: ReturnType<typeof groupFeatures>,
  width: number,
  spanBp = 1000,
) {
  return new Map(
    groups.map(g => [
      g.key,
      ((g.anchor.start + g.anchor.end) / 2 / spanBp) * width,
    ]),
  )
}

function anchorSeedX(bp: number, width: number, spanBp = 1000) {
  return (bp / spanBp) * width
}

const features = [
  pairFeature({
    uniqueId: '1',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      name: 'p1',
    },
  }),
  pairFeature({
    uniqueId: '2',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'cacao',
      refName: 'Cc1',
      start: 9000,
      end: 9100,
      name: 'c1',
    },
  }),
  pairFeature({
    uniqueId: '3',
    name: 'g2',
    start: 300,
    end: 400,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1200,
      end: 1300,
      name: 'p2',
    },
  }),
  pairFeature({
    uniqueId: '4',
    name: 'g3',
    start: 500,
    end: 600,
    mate: {
      assemblyName: 'cacao',
      refName: 'Cc1',
      start: 8000,
      end: 8100,
      name: 'c3',
    },
  }),
  // repeated mate placement, as a reference-anchored table produces
  pairFeature({
    uniqueId: '5',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      name: 'p1',
    },
  }),
]

test('groups by anchor gene, dedupes repeated mates, sorts by anchor position', () => {
  const groups = groupFeatures(features)
  expect(groups.map(g => g.key)).toEqual(['g1', 'g2', 'g3'])
  expect(groups[0]!.mates.get('peach')).toHaveLength(1)
  expect(groups[0]!.mates.get('cacao')).toHaveLength(1)
  expect(groups[1]!.mates.has('cacao')).toBe(false)
})

// the display binds this to `isSameAssemblyName` over the session's assembly
// manager; a fixture spelling every name canonically needs only equality
const exactName = (a: string, b: string) => a === b

test('row assemblies come out densest lane first, rowOrder pinning over that', () => {
  expect(rowAssembliesOf(groupFeatures(features), [], exactName)).toEqual([
    'peach',
    'cacao',
  ])
  expect(
    rowAssembliesOf(groupFeatures(features), ['cacao'], exactName),
  ).toEqual(['cacao', 'peach'])
})

// `rowOrder` is authored in a session spec or a config defaultSession, so it
// spells an assembly the way the session does, while the lane it has to match
// is spelled the way the synteny table's BED did. Comparing those raw is the
// `===` the assembly-name rule forbids, and it fails by silently pinning
// nothing.
test('rowOrder pins a lane it names through an alias', () => {
  const canonical = (name: string) =>
    name === 'Theobroma_cacao' ? 'cacao' : name
  expect(
    rowAssembliesOf(
      groupFeatures(features),
      ['Theobroma_cacao'],
      (a, b) => canonical(a) === canonical(b),
    ),
  ).toEqual(['cacao', 'peach'])
})

// A ribbon connects ADJACENT lanes only, so a lane holding one placement sitting
// above a lane holding four cuts every chain that would have run through it.
test('a sparse lane sorts below a denser one that appears after it', () => {
  const sparseFirst = [
    pairFeature({
      uniqueId: 's1',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'sparse',
        refName: 'S1',
        start: 10,
        end: 20,
        name: 's1',
      },
    }),
    ...['a', 'b', 'c'].map((suffix, i) =>
      pairFeature({
        uniqueId: `d${suffix}`,
        name: `g${i + 1}`,
        start: 100 * (i + 1),
        end: 100 * (i + 1) + 50,
        mate: {
          assemblyName: 'dense',
          refName: 'D1',
          start: 1000 * (i + 1),
          end: 1000 * (i + 1) + 50,
          name: `d${suffix}`,
        },
      }),
    ),
  ]
  expect(rowAssembliesOf(groupFeatures(sparseFirst), [], exactName)).toEqual([
    'dense',
    'sparse',
  ])
})

test('a lane frame snaps to a multiple of the anchor span', () => {
  const groups = groupFeatures(features)
  const frame = computeRowFrame(groups, 'peach', 1000)!
  expect((frame.max - frame.min) / 1000).toBeCloseTo(1)
})

// The whole point of the ladder: a pan that does not change which rung a lane
// sits on leaves the lane's content where it was, instead of sliding it under
// its own ribbons.
test('a small change in the placements leaves a snapped frame alone', () => {
  const peachPair = (uniqueId: string, name: string, mateStart: number) =>
    pairFeature({
      uniqueId,
      name,
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: mateStart,
        end: mateStart + 100,
        name: 'p1',
      },
    })
  const before = computeRowFrame(
    groupFeatures([peachPair('1', 'g1', 1000), peachPair('2', 'g2', 1200)]),
    'peach',
    1000,
  )!
  const after = computeRowFrame(
    groupFeatures([peachPair('1', 'g1', 1007), peachPair('2', 'g2', 1207)]),
    'peach',
    1000,
  )!
  expect(after.min).toBe(before.min)
  expect(after.max).toBe(before.max)
})

test('the shared tick interval is a 1/2/5 step landing a few ticks per span', () => {
  expect(tickIntervalFor(88000)).toBe(20000)
  expect(tickIntervalFor(200000)).toBe(50000)
  expect(tickIntervalFor(1000)).toBe(200)
})

// Two lanes drawn at the same bp/px put their ticks at the same spacing, and a
// lane zoomed out by 2x puts them at half of it. That spacing IS the scale
// statement the headers otherwise make a reader compute.
test('tick spacing across lanes reports the ratio of their scales', () => {
  const tight = frameTickXs(
    {
      refName: 'a',
      min: 0,
      max: 100000,
      flipped: false,
      fitMin: 0,
      fitMax: 100000,
    },
    20000,
    800,
  )
  const wide = frameTickXs(
    {
      refName: 'a',
      min: 0,
      max: 200000,
      flipped: false,
      fitMin: 0,
      fitMax: 200000,
    },
    20000,
    800,
  )
  expect(tight[1]! - tight[0]!).toBeCloseTo(2 * (wide[1]! - wide[0]!))
})

test('a lane far enough out that its ticks would hatch draws none', () => {
  expect(
    frameTickXs(
      {
        refName: 'a',
        min: 0,
        max: 100000000,
        flipped: false,
        fitMin: 0,
        fitMax: 100000000,
      },
      20000,
      800,
    ),
  ).toEqual([])
})

test('a forward row frame spans its placements unflipped', () => {
  const groups = groupFeatures(features)
  const frame = computeRowFrame(groups, 'peach')!
  expect(frame.refName).toBe('Pp1')
  expect(frame.flipped).toBe(false)
  expect(frame.min).toBeLessThanOrEqual(1000)
  expect(frame.max).toBeGreaterThanOrEqual(1300)
})

test('a row whose placements run against the anchor order flips', () => {
  const frame = computeRowFrame(groupFeatures(features), 'cacao')!
  expect(frame.flipped).toBe(true)
  const width = 800
  const g1x = rowFrameX(frame, 9050, width)
  const g3x = rowFrameX(frame, 8050, width)
  expect(g1x).toBeLessThan(g3x)
})

test('features carrying syntenyId group on it even with no names', () => {
  const groups = groupFeatures([
    new SimpleFeature({
      uniqueId: '0-1-0-7',
      refName: 'chr1',
      start: 100,
      end: 200,
      syntenyId: 7,
      assemblyName: 'anchor',
      mate: { assemblyName: 'peach', refName: 'Pp1', start: 1000, end: 1100 },
    }),
    new SimpleFeature({
      uniqueId: '0-2-0-7',
      refName: 'chr1',
      start: 100,
      end: 200,
      syntenyId: 7,
      assemblyName: 'anchor',
      mate: { assemblyName: 'cacao', refName: 'Cc1', start: 9000, end: 9100 },
    }),
  ])
  expect(groups).toHaveLength(1)
  expect([...groups[0]!.mates.keys()]).toEqual(['peach', 'cacao'])
})

test('a group with nothing on the dominant refName gets no span on that row', () => {
  const groups = groupFeatures([
    ...features,
    pairFeature({
      uniqueId: '6',
      name: 'g4',
      start: 700,
      end: 800,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp2',
        start: 50,
        end: 60,
        name: 'px',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach')!
  expect(frame.refName).toBe('Pp1')
  const g4 = groups.find(g => g.key === 'g4')!
  expect(groupSpansOnRow(g4, 'peach', frame, 800)).toEqual([])
  const g1 = groups.find(g => g.key === 'g1')!
  const span = groupSpansOnRow(g1, 'peach', frame, 800)[0]!
  expect(span[0]).toBeLessThan(span[1])
})

test('geneGlyphShape merges exons across transcripts and falls back to the span', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'chr1',
    start: 100,
    end: 400,
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'e1',
            refName: 'chr1',
            start: 100,
            end: 150,
            type: 'exon',
          },
          {
            uniqueId: 'e2',
            refName: 'chr1',
            start: 300,
            end: 400,
            type: 'exon',
          },
        ],
      },
      {
        uniqueId: 'rna2',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'e3',
            refName: 'chr1',
            start: 120,
            end: 200,
            type: 'exon',
          },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [100, 200],
      [300, 400],
    ],
    thin: [],
  })
  const bare = new SimpleFeature({
    uniqueId: 'bare',
    refName: 'chr1',
    start: 5,
    end: 10,
  })
  expect(geneGlyphShape(bare)).toEqual({ full: [[5, 10]], thin: [] })
})

test('geneGlyphShape splits merged exons into CDS and UTR intervals', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene2',
    refName: 'chr1',
    start: 100,
    end: 400,
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'x1',
            refName: 'chr1',
            start: 100,
            end: 160,
            type: 'exon',
          },
          {
            uniqueId: 'x2',
            refName: 'chr1',
            start: 300,
            end: 400,
            type: 'exon',
          },
          {
            uniqueId: 'c1',
            refName: 'chr1',
            start: 140,
            end: 160,
            type: 'CDS',
          },
          {
            uniqueId: 'c2',
            refName: 'chr1',
            start: 300,
            end: 380,
            type: 'CDS',
          },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [140, 160],
      [300, 380],
    ],
    thin: [
      [100, 140],
      [380, 400],
    ],
  })
})

test('geneGlyphShape draws a CDS-only annotation full height', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene3',
    refName: 'chr1',
    start: 100,
    end: 200,
    subfeatures: [
      { uniqueId: 'c1', refName: 'chr1', start: 100, end: 150, type: 'CDS' },
      { uniqueId: 'c2', refName: 'chr1', start: 170, end: 200, type: 'CDS' },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [100, 150],
      [170, 200],
    ],
    thin: [],
  })
})

test('laneGeneFeatures drops the whole-sequence region row, keeps genes', () => {
  const region = new SimpleFeature({
    uniqueId: 'r',
    refName: 'chr1',
    start: 0,
    end: 1000000,
    type: 'region',
  })
  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'chr1',
    start: 10,
    end: 20,
    type: 'gene',
  })
  const pseudo = new SimpleFeature({
    uniqueId: 'p',
    refName: 'chr1',
    start: 30,
    end: 40,
    type: 'pseudogene',
  })
  expect(laneGeneFeatures([region, gene, pseudo]).map(f => f.id())).toEqual([
    'g',
    'p',
  ])
  const mrna = new SimpleFeature({
    uniqueId: 'm',
    refName: 'chr1',
    start: 30,
    end: 40,
    type: 'mRNA',
  })
  expect(laneGeneFeatures([region, mrna]).map(f => f.id())).toEqual(['m'])
})

test('a far-flung repeat placement does not stretch the frame', () => {
  const groups = groupFeatures([
    ...features,
    pairFeature({
      uniqueId: '7',
      name: 'g5',
      start: 700,
      end: 800,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 900000,
        end: 900050,
        name: 'repeat-hit',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach', 1000)!
  expect(frame.max).toBeLessThan(10000)
})

// A repeat hit megabases away is thrown out of the FRAME by computeRowFrame's
// median filter, and used to come straight back as a drawn span: rowFrameX
// extrapolates, so the group's px span ran tens of thousands of pixels wide and
// the ribbon on it swept the page.
test('a placement outside the frame does not reach the drawn span', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1000,
        end: 1100,
        name: 'p1',
      },
    }),
    pairFeature({
      uniqueId: '2',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 900000,
        end: 900100,
        name: 'repeat-hit',
      },
    }),
    pairFeature({
      uniqueId: '3',
      name: 'g2',
      start: 300,
      end: 400,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1200,
        end: 1300,
        name: 'p2',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach', 1000)!
  const spans = groupSpansOnRow(groups[0]!, 'peach', frame, 800)
  // the repeat hit is not a second run either — it is not drawn at all
  expect(spans).toHaveLength(1)
  expect(spans[0]![1] - spans[0]![0]).toBeLessThan(800)
})

// The lane's scale comes off the ladder and its offset comes off the ribbons:
// with both lanes at the same rung and the same gene spacing, the offset pass
// should put every ortholog at the same x as the anchor, and the ribbons
// between them go vertical.
test('a lane slides to line its orthologs up with the lane above', () => {
  const groups = groupFeatures(
    [100, 300, 500, 700].map((start, i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start,
        end: start + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: start + 500000,
          end: start + 500060,
          name: `p${i}`,
        },
      }),
    ),
  )
  const frames = alignRowFrames(
    groups,
    ['peach'],
    anchorSeed(groups, 800),
    1000,
    800,
  )
  const frame = frames.get('peach')!
  const offsets = groups.map(group => {
    const anchorX = anchorSeedX(group.anchor.start + 30, 800)
    const laneX = rowFrameX(
      frame,
      group.mates.get('peach')![0]!.start + 30,
      800,
    )
    return Math.abs(anchorX - laneX)
  })
  expect(Math.max(...offsets)).toBeLessThanOrEqual(8)
})

test('the aligned frame still covers the placements it was fitted to', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 900,
      end: 960,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 500000,
        end: 500060,
        name: 'p1',
      },
    }),
    pairFeature({
      uniqueId: '2',
      name: 'g2',
      start: 940,
      end: 1000,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 500700,
        end: 500760,
        name: 'p2',
      },
    }),
  ])
  const frame = alignRowFrames(
    groups,
    ['peach'],
    anchorSeed(groups, 800),
    1000,
    800,
  ).get('peach')!
  expect(frame.min).toBeLessThanOrEqual(500000)
  expect(frame.max).toBeGreaterThanOrEqual(500760)
})

// The center snap can move a frame by half a grid step, which is more than the
// rung leaves over a fit that nearly fills it. A frame that misses its own fit
// misses it silently: the placement at that edge stops being drawn, the ribbon
// skips the lane, and `laneFetchWindow` stops asking for the genes there.
test('a fit that nearly fills its rung is still covered by the snapped frame', () => {
  const mateLane = (mateStart: number, mateEnd: number) =>
    groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 160,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: mateStart,
          end: mateStart + 60,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g2',
        start: 900,
        end: 960,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: mateEnd - 60,
          end: mateEnd,
          name: 'p2',
        },
      }),
    ])

  const frame = computeRowFrame(mateLane(500000, 500913), 'peach', 1000)!
  expect(frame.max - frame.min).toBe(1000)
  expect(frame.min).toBeLessThanOrEqual(frame.fitMin)
  expect(frame.max).toBeGreaterThanOrEqual(frame.fitMax)

  for (const width of [913, 950, 990, 1450, 1950, 2900, 4900, 7900]) {
    for (const offset of [0, 37, 62, 88, 121]) {
      const start = 500000 + offset
      const lane = computeRowFrame(
        mateLane(start, start + width),
        'peach',
        1000,
      )!
      expect(lane.min).toBeLessThanOrEqual(lane.fitMin)
      expect(lane.max).toBeGreaterThanOrEqual(lane.fitMax)
      const window = laneFetchWindow(lane)
      expect(window.min).toBeLessThanOrEqual(lane.min)
      expect(window.max).toBeGreaterThanOrEqual(lane.max)
    }
  }
})

// A mate lane whose gene order runs backwards against the lane above is
// mirrored, which is the worst zigzag available: every ribbon crosses.
test('a lane running against the lane above comes out flipped', () => {
  const groups = groupFeatures(
    [100, 300, 500, 700].map((start, i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start,
        end: start + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 500000 - start,
          end: 500060 - start,
          name: `p${i}`,
        },
      }),
    ),
  )
  expect(
    alignRowFrames(groups, ['peach'], anchorSeed(groups, 800), 1000, 800).get(
      'peach',
    )!.flipped,
  ).toBe(true)
})

// The fetch window has to survive the alignment shift and the viewport width,
// or a lane refetches its annotation because the browser window was resized.
test('the lane fetch window covers every position the frame can slide to', () => {
  const groups = groupFeatures(
    [100, 300, 500].map((start, i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start,
        end: start + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: start + 500000,
          end: start + 500060,
          name: `p${i}`,
        },
      }),
    ),
  )
  const windows = [400, 800, 1600].map(width => {
    const frame = alignRowFrames(
      groups,
      ['peach'],
      anchorSeed(groups, width),
      1000,
      width,
    ).get('peach')!
    return { frame, reach: laneFetchWindow(frame) }
  })
  for (const { reach } of windows) {
    expect(reach).toEqual(windows[0]!.reach)
  }
  for (const { frame } of windows) {
    expect(frame.min).toBeGreaterThanOrEqual(windows[0]!.reach.min)
    expect(frame.max).toBeLessThanOrEqual(windows[0]!.reach.max)
  }
})

// The ladder rounds a lane's span UP and then snaps its center to an eighth of
// that span, and both moves push `min` down. Near a contig start that took it
// below zero: the lane header printed `Pp1:-139` and `frameTickXs` walked from
// a negative bp, so the lane stated a coordinate its contig does not have.
describe('a lane frame near a contig start', () => {
  function nearZeroGroups(start: number) {
    return groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 200,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start,
          end: start + 100,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g2',
        start: 300,
        end: 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: start + 500,
          end: start + 600,
          name: 'p2',
        },
      }),
    ])
  }

  test.each([0, 60, 100, 500, 5000])(
    'stays at or above zero with placements from %ibp',
    start => {
      const frame = computeRowFrame(nearZeroGroups(start), 'peach', 1000)!
      expect(frame.min).toBeGreaterThanOrEqual(0)
      expect(frame.fitMin).toBeGreaterThanOrEqual(0)
    },
  )

  test('keeps its ladder rung rather than being squashed against zero', () => {
    const away = computeRowFrame(nearZeroGroups(50_000), 'peach', 1000)!
    const atZero = computeRowFrame(nearZeroGroups(0), 'peach', 1000)!
    expect(atZero.max - atZero.min).toBeCloseTo(away.max - away.min, 6)
  })

  test('still covers the placements it was fitted to', () => {
    const frame = computeRowFrame(nearZeroGroups(0), 'peach', 1000)!
    expect(frame.min).toBe(0)
    expect(frame.max).toBeGreaterThanOrEqual(600)
  })
})

// The pair's orientation is the pairwise feature's own strand. `mate.strand` is
// a different quantity where it exists at all — the MCScan blocks adapter fills
// it with the mate gene's transcription strand, and the PAF adapters never
// write it — so reading it read a field with two meanings or none.
test('a placement takes its orientation from the feature, not from the mate', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 100,
      end: 200,
      strand: -1,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1000,
        end: 1100,
        name: 'p1',
      },
    }),
    pairFeature({
      uniqueId: '2',
      name: 'g2',
      start: 300,
      end: 400,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1200,
        end: 1300,
        name: 'p2',
      },
    }),
  ])
  expect(groups.map(g => g.mates.get('peach')![0]!.orientation)).toEqual([
    -1, 1,
  ])
})

// A reverse-strand block's two ends correspond crosswise, so the span it hands
// the ribbon comes back reversed and the parallelogram drawn from it crosses.
// Nothing in the tree exercised this: the MCScan blocks format carries no CIGAR
// and volvox_all_vs_all.paf is three `+` records.
describe('a reverse-strand block', () => {
  function orientedGroups(strand: number) {
    return groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 200,
        strand,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1000,
          end: 1100,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g2',
        start: 300,
        end: 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1200,
          end: 1300,
          name: 'p2',
        },
      }),
    ])
  }

  test('hands the ribbon its ends the other way round', () => {
    const forward = orientedGroups(1)
    const reverse = orientedGroups(-1)
    const frame = computeRowFrame(forward, 'peach', 1000)!
    const fwd = groupSpansOnRow(forward[0]!, 'peach', frame, 800)[0]!
    const rev = groupSpansOnRow(reverse[0]!, 'peach', frame, 800)[0]!
    expect(fwd[0]).toBeLessThan(fwd[1])
    expect(rev[0]).toBeGreaterThan(rev[1])
    expect(rev).toEqual([fwd[1], fwd[0]])
  })

  test('leaves the forward block beside it untwisted', () => {
    const groups = orientedGroups(-1)
    const frame = computeRowFrame(groups, 'peach', 1000)!
    const g2 = groupSpansOnRow(groups[1]!, 'peach', frame, 800)[0]!
    expect(g2[0]).toBeLessThan(g2[1])
  })
})

// A lane the layout mirrored draws a forward block reversed, because the
// mirroring is what a ribbon reaching it has to cross. The lane-level `[rev]`
// tag states the mirroring; the ribbon states the block.
test('a flipped lane reverses the ends of a forward block', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1000,
        end: 1100,
        name: 'p1',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach', 1000)!
  const upright = groupSpansOnRow(groups[0]!, 'peach', frame, 800)[0]!
  const mirrored = groupSpansOnRow(
    groups[0]!,
    'peach',
    { ...frame, flipped: true },
    800,
  )[0]!
  expect(upright[0]).toBeLessThan(upright[1])
  expect(mirrored[0]).toBeGreaterThan(mirrored[1])
})

// Two placements of one anchor gene on one lane — what a blocks table's copy
// columns produce, and what an `--iter=2` jcvi run writes routinely.
describe('a group placed twice on one lane', () => {
  function twiceGroups(secondStart: number, secondStrand = 1) {
    return groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 200,
        strand: -1,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1000,
          end: 1600,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g1',
        start: 100,
        end: 200,
        strand: secondStrand,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: secondStart,
          end: secondStart + 70,
          name: 'p1b',
        },
      }),
      pairFeature({
        uniqueId: '3',
        name: 'g2',
        start: 300,
        end: 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1800,
          end: 1900,
          name: 'p2',
        },
      }),
    ])
  }

  // Min-of-starts to max-of-ends across the pair drew the GAP between them as
  // syntenic sequence: one block where the truth is two, most of it aligning to
  // nothing.
  test('draws its two disjoint hits as two spans, not one over the gap', () => {
    const groups = twiceGroups(1700)
    const frame = computeRowFrame(groups, 'peach', 1000)!
    const spans = groupSpansOnRow(groups[0]!, 'peach', frame, 800)
    expect(spans).toHaveLength(2)
    const [first, second] = spans as [
      readonly [number, number],
      readonly [number, number],
    ]
    const drawn = [first, second].reduce(
      (sum, [a, b]) => sum + Math.abs(b - a),
      0,
    )
    const ends = [...first, ...second]
    const merged = Math.max(...ends) - Math.min(...ends)
    // the 100bp between the two hits, at the frame's 0.8 px/bp, is now unpainted
    expect(merged - drawn).toBeCloseTo(80, 6)
  })

  // Placements that really do touch are one block, and the run they form takes
  // the length-weighted sign: a short fragment aligning the other way cannot
  // flip the block it sits inside.
  test('merges the hits that touch, under the length-weighted sign', () => {
    const groups = twiceGroups(1550)
    const frame = computeRowFrame(groups, 'peach', 1000)!
    const spans = groupSpansOnRow(groups[0]!, 'peach', frame, 800)
    expect(spans).toHaveLength(1)
    expect(spans[0]![0]).toBeGreaterThan(spans[0]![1])
  })
})

// The fit-side guard is `snapFrameToLadder`'s; this is the other half. The
// alignment shift is clamped to the slack the rung left over the fitted extent,
// which for a lane whose placements fill a fraction of its rung is most of the
// span — so a lane that fits near a contig start could be slid back below zero
// after being placed, and the header printed a coordinate the contig does not
// have.
test('the alignment shift cannot slide a lane below zero', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 700,
      end: 800,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 0,
        end: 100,
        name: 'p1',
      },
    }),
    pairFeature({
      uniqueId: '2',
      name: 'g2',
      start: 900,
      end: 1000,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 500,
        end: 600,
        name: 'p2',
      },
    }),
  ])
  const width = 800
  // the anchor draws this pair at the RIGHT of the canvas while the lane fits
  // them at its left, so the offset pass wants to slide the lane left
  const frame = alignRowFrames(
    groups,
    ['peach'],
    anchorSeed(groups, width),
    1000,
    width,
  ).get('peach')!
  expect(frame.min).toBeGreaterThanOrEqual(0)
  expect(frame.max).toBeGreaterThanOrEqual(frame.fitMax)
})

// `rowFrameX` extrapolates, so an endpoint the frame does not reach maps to
// tens of thousands of px: the rect drawn from it is clipped by the svg and
// looks fine while the ribbon on it sweeps the page. The lane-links fetch asks
// for the whole window the frame can SLIDE in, which is wider than the frame by
// construction, so records outside it arrive on every fetch.
test('a span outside the frame has no px pair to draw from', () => {
  const frame = computeRowFrame(groupFeatures(features), 'peach', 1000)!
  const region = laneFetchRegion(frame)
  expect(region.end).toBeGreaterThan(frame.max)

  expect(frameSpan(frame, frame.min + 10, frame.min + 20, 800)).toBeDefined()
  expect(frameSpan(frame, region.end - 10, region.end, 800)).toBeUndefined()
})

// The anchor lane's genes are fetched over the view's static blocks, so a gene
// straddling a block boundary comes back once per block it touches — two
// glyphs, and two React children under one key.
test('lane genes arriving once per static block draw once', () => {
  const gene = (uniqueId: string) =>
    new SimpleFeature({
      uniqueId,
      refName: 'ctgA',
      start: 900,
      end: 1100,
      type: 'gene',
    })
  expect(laneGeneFeatures([gene('g1'), gene('g1'), gene('g2')])).toHaveLength(2)
})

// A lane's own contig is whichever explains the most of the ANCHOR window, the
// vote `resolvePanel` runs on the same axis for the panel this lane launches.
// Counting placements instead let a cluster of short repeat hits outvote the
// syntenic blocks that are the lane, and put the launch and the lane it
// launched from on different contigs.
test('a lane sits on the contig explaining the most anchor bp, not the most hits', () => {
  const groups = groupFeatures([
    // three short repeat hits...
    ...['a', 'b', 'c'].map((suffix, i) =>
      pairFeature({
        uniqueId: `repeat${suffix}`,
        name: `r${suffix}`,
        start: 100 * (i + 1),
        end: 100 * (i + 1) + 20,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp_repeats',
          start: 1000 * (i + 1),
          end: 1000 * (i + 1) + 20,
          name: `r${suffix}`,
        },
      }),
    ),
    // ...against two syntenic blocks, which are fewer and far longer
    ...['d', 'e'].map((suffix, i) =>
      pairFeature({
        uniqueId: `block${suffix}`,
        name: `b${suffix}`,
        start: 1000 * (i + 1),
        end: 1000 * (i + 1) + 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 5000 * (i + 1),
          end: 5000 * (i + 1) + 400,
          name: `b${suffix}`,
        },
      }),
    ),
  ])
  expect(computeRowFrame(groups, 'peach')!.refName).toBe('Pp1')
})

// ...and it has to be the SAME vote, on the same axis: a lane's contig and the
// contig the panel launched off it opens on come from two functions over one
// dataset, and a reader who launches a lane expects the panel to be the lane.
// This fixture is built so the two axes disagree — long anchor genes against
// short mate fragments on one contig, the reverse on the other — so weighing
// mate bp on either side would split them.
test('the lane and the panel launched off it pick the same contig', () => {
  const mixed = [
    ...['a', 'b', 'c'].map((suffix, i) =>
      pairFeature({
        uniqueId: `long-anchor-${suffix}`,
        name: `la${suffix}`,
        start: 1000 * (i + 1),
        end: 1000 * (i + 1) + 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp2',
          start: 2000 * (i + 1),
          end: 2000 * (i + 1) + 20,
          name: `la${suffix}`,
        },
      }),
    ),
    ...['d', 'e'].map((suffix, i) =>
      pairFeature({
        uniqueId: `long-mate-${suffix}`,
        name: `lm${suffix}`,
        start: 100 * (i + 1),
        end: 100 * (i + 1) + 20,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 5000 * (i + 1),
          end: 5000 * (i + 1) + 400,
          name: `lm${suffix}`,
        },
      }),
    ),
  ]
  expect(computeRowFrame(groupFeatures(mixed), 'peach')!.refName).toBe(
    resolvePanel(mixed, undefined)!.refName,
  )
})

// A lane refetches when the region it asks for moves, and the fitted extent
// moves whenever a group enters or leaves the settled viewport. Taking the
// quantum off the fetch WINDOW's width tied the two together: that width runs
// over [span, 2*span), which straddles a power of two, so one ortholog arriving
// could halve the grid and refetch every lane for a gesture that moved no
// frame. Off the rung span it cannot.
test('a lane fetches the same region as its fitted extent wobbles', () => {
  const frame = (fitMax: number) => ({
    refName: 'Pp1',
    min: 0,
    max: 100000,
    flipped: false,
    fitMin: 0,
    fitMax,
  })
  // 131,072 sits between the two window widths these produce
  expect(laneFetchRegion(frame(68900))).toEqual(laneFetchRegion(frame(69000)))
})

describe('lane geometry', () => {
  // The bands are what stops the view's gridlines — true on the anchor lane
  // and a lie on every other one — at the anchor. A band covering only its own
  // header and glyphs left them standing in the gutters, which is most of the
  // ink in a tall track.
  test('the bands below the anchor tile without gaps', () => {
    const { rows } = laneGeometry(240, 4)
    for (const [row, band] of rows.entries()) {
      if (row > 0) {
        expect(band.bandStart).toBeCloseTo(rows[row - 1]!.bandEnd, 6)
        expect(band.bandStart).toBeLessThan(band.bandTop)
      }
    }
    expect(rows.at(-1)!.bandEnd).toBe(240)
  })

  test('every lane fits inside the track height, at any lane count', () => {
    for (const rowCount of [1, 2, 5, 12]) {
      const { glyphHeight, rows } = laneGeometry(240, rowCount)
      expect(rows).toHaveLength(rowCount)
      expect(rows[0]!.bandTop).toBeGreaterThanOrEqual(0)
      expect(rows.at(-1)!.glyphTop + glyphHeight).toBeLessThanOrEqual(240)
    }
  })
})
