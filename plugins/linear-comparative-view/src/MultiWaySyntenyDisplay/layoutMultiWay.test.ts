import { SimpleFeature } from '@jbrowse/core/util'

import {
  alignRowFrames,
  computeRowFrame,
  frameTickXs,
  laneFetchWindow,
  geneGlyphShape,
  groupFeatures,
  groupSpanOnRow,
  laneGeneFeatures,
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
    strand?: number
    name: string
  }
}) {
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end,
    strand,
    name,
    assemblyName: 'anchor',
    mate: { strand: 1, ...mate },
  })
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
  expect(groups.map(g => g.name)).toEqual(['g1', 'g2', 'g3'])
  expect(groups[0]!.mates.get('peach')).toHaveLength(1)
  expect(groups[0]!.mates.get('cacao')).toHaveLength(1)
  expect(groups[1]!.mates.has('cacao')).toBe(false)
})

test('row assemblies come out densest lane first, rowOrder pinning over that', () => {
  expect(rowAssembliesOf(groupFeatures(features), [])).toEqual([
    'peach',
    'cacao',
  ])
  expect(rowAssembliesOf(groupFeatures(features), ['cacao'])).toEqual([
    'cacao',
    'peach',
  ])
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
  expect(rowAssembliesOf(groupFeatures(sparseFirst), [])).toEqual([
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
  const g4 = groups.find(g => g.name === 'g4')!
  expect(groupSpanOnRow(g4, 'peach', frame, 800)).toBeUndefined()
  const g1 = groups.find(g => g.name === 'g1')!
  const span = groupSpanOnRow(g1, 'peach', frame, 800)!
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
  const span = groupSpanOnRow(groups[0]!, 'peach', frame, 800)!
  expect(span[1] - span[0]).toBeLessThan(800)
})

// The lane's scale comes off the ladder and its offset comes off the ribbons:
// with both lanes at the same rung and the same gene spacing, the offset pass
// should put every ortholog at the same x as the anchor, and the ribbons
// between them go vertical.
test('a lane slides to line its orthologs up with the lane above', () => {
  const anchorFrame = {
    refName: 'chr1',
    min: 0,
    max: 1000,
    flipped: false,
    fitMin: 0,
    fitMax: 1000,
  }
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
  const frames = alignRowFrames(groups, ['peach'], anchorFrame, 1000, 800)
  const frame = frames.get('peach')!
  const offsets = groups.map(group => {
    const anchorX = rowFrameX(anchorFrame, group.anchor.start + 30, 800)
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
  const anchorFrame = {
    refName: 'chr1',
    min: 0,
    max: 1000,
    flipped: false,
    fitMin: 0,
    fitMax: 1000,
  }
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
  const frame = alignRowFrames(groups, ['peach'], anchorFrame, 1000, 800).get(
    'peach',
  )!
  expect(frame.min).toBeLessThanOrEqual(500000)
  expect(frame.max).toBeGreaterThanOrEqual(500760)
})

// A mate lane whose gene order runs backwards against the lane above is
// mirrored, which is the worst zigzag available: every ribbon crosses.
test('a lane running against the lane above comes out flipped', () => {
  const anchorFrame = {
    refName: 'chr1',
    min: 0,
    max: 1000,
    flipped: false,
    fitMin: 0,
    fitMax: 1000,
  }
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
    alignRowFrames(groups, ['peach'], anchorFrame, 1000, 800).get('peach')!
      .flipped,
  ).toBe(true)
})

// The fetch window has to survive the alignment shift and the viewport width,
// or a lane refetches its annotation because the browser window was resized.
test('the lane fetch window covers every position the frame can slide to', () => {
  const anchorFrame = {
    refName: 'chr1',
    min: 0,
    max: 1000,
    flipped: false,
    fitMin: 0,
    fitMax: 1000,
  }
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
      anchorFrame,
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
