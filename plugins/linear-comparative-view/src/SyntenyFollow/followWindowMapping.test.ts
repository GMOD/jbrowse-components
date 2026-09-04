import { SimpleFeature } from '@jbrowse/core/util'

import { resolvePanel } from '../LaunchSyntenyView/resolvePanel.ts'
import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import {
  followWindowMapping,
  followWindowsMapping,
} from './followWindowMapping.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FeatureBlock } from '../LinearSyntenyDisplay/testUtils.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// A grape window mapping onto peach, so the defaults name the right pair.
function data(blocks: (FeatureBlock & { mateStart: number })[]) {
  return packSyntenyFeatureData(
    blocks.map(b => ({
      ...b,
      assembly: 'grape',
      mateRefName: b.mateRefName ?? 'Pp01',
      mateAssembly: b.mateAssembly ?? 'peach',
    })),
    { hasCigar: false },
  )
}

const win = (start: number, end: number, refName = 'chr1'): FollowWindow => ({
  refName,
  start,
  end,
})

const map = (d: SyntenyFeatureData, w: FollowWindow, mateAssembly?: string) =>
  followWindowMapping({ data: d, window: w, toMate: true, mateAssembly })

// Three collinear blocks with gaps between them — the shape of gene-anchor
// synteny, and the shape that made the union answer a staircase.
const anchors = data([
  { start: 100_000, end: 200_000, mateStart: 1_100_000, mateEnd: 1_200_000 },
  { start: 400_000, end: 500_000, mateStart: 1_400_000, mateEnd: 1_500_000 },
  { start: 800_000, end: 900_000, mateStart: 1_800_000, mateEnd: 1_900_000 },
])

test('a window inside the blocks maps through them', () => {
  expect(map(anchors, win(150_000, 850_000))).toEqual({
    refName: 'Pp01',
    start: 1_150_000,
    end: 1_850_000,
  })
})

test('an edge in a gap interpolates between the blocks either side', () => {
  // 300,000 is halfway between block 1 ending at 200,000 and block 2 starting
  // at 400,000, so it maps halfway between 1,200,000 and 1,400,000
  expect(map(anchors, win(300_000, 850_000))?.start).toBe(1_300_000)
})

// The property the whole file exists for. The union of the mapped blocks moves
// only when a block enters or leaves the window, which on a real pan is one
// movement in thirty; mapping the edges moves on every step.
test('the mapping is continuous: every small pan moves the answer', () => {
  const seen = new Set<number>()
  for (let x = 250_000; x <= 350_000; x += 5_000) {
    seen.add(map(anchors, win(x, x + 400_000))!.start)
  }
  expect(seen.size).toBe(21)
})

test('it is continuous across a block boundary, not just inside gaps', () => {
  // approaching 200,000 (a block's right edge) from inside and from the gap
  // has to agree, or the followed row steps as the edge crosses
  const justInside = map(anchors, win(199_999, 600_000))!.start
  const atEdge = map(anchors, win(200_000, 600_000))!.start
  const justOutside = map(anchors, win(200_001, 600_000))!.start
  expect(atEdge).toBe(1_200_000)
  expect(atEdge - justInside).toBeCloseTo(1, 0)
  expect(justOutside - atEdge).toBeCloseTo(1, 0)
})

test('past the outermost block the answer stops rather than extrapolating', () => {
  // nothing is known out there, and inventing a scale measured elsewhere would
  // present a correspondence where there is none
  expect(map(anchors, win(0, 850_000))?.start).toBe(1_100_000)
  expect(map(anchors, win(150_000, 2_000_000))?.end).toBe(1_900_000)
})

test('a window with nothing under it has no answer', () => {
  expect(map(anchors, win(2_000_000, 3_000_000))).toBeUndefined()
})

test('the target contig most of the window aligns to wins the rest', () => {
  const d = data([
    { start: 0, end: 400_000, mateStart: 1_000_000, mateEnd: 1_400_000 },
    { start: 400_000, end: 900_000, mateStart: 1_400_000, mateEnd: 1_900_000 },
    {
      start: 950_000,
      end: 960_000,
      mateRefName: 'Pp08',
      mateStart: 20_000_000,
      mateEnd: 20_010_000,
    },
  ])
  expect(map(d, win(0, 1_000_000))).toMatchObject({ refName: 'Pp01' })
})

test('an all-vs-all lane the level is not about stays out of it', () => {
  const d = data([
    { start: 100_000, end: 200_000, mateStart: 1_000_000, mateEnd: 1_100_000 },
    {
      start: 800_000,
      end: 900_000,
      mateStart: 9_000_000,
      mateEnd: 9_100_000,
      mateAssembly: 'cacao',
    },
  ])
  expect(map(d, win(0, 1_000_000), 'peach')).toEqual({
    refName: 'Pp01',
    start: 1_000_000,
    end: 1_100_000,
  })
})

test('a reverse-strand block maps its left edge to the mate right', () => {
  const d = data([
    {
      start: 100_000,
      end: 200_000,
      mateStart: 1_000_000,
      mateEnd: 1_100_000,
      strand: -1,
    },
  ])
  // the window covers the block's left quarter, which is the mate's RIGHT
  // quarter
  expect(map(d, win(100_000, 125_000))).toEqual({
    refName: 'Pp01',
    start: 1_075_000,
    end: 1_100_000,
  })
})

// A whole-genome anchor shows every contig at once, and the blocks are the
// expensive part — so the several windows are answered in ONE scan of them.
describe('several windows at once', () => {
  const genome = data([
    { start: 100_000, end: 900_000, mateStart: 100_000, mateEnd: 900_000 },
    {
      refName: 'chr2',
      start: 50_000,
      end: 450_000,
      mateRefName: 'Pp02',
      mateStart: 50_000,
      mateEnd: 450_000,
    },
  ])

  test('each window is answered on its own contig', () => {
    expect(
      followWindowsMapping({
        data: genome,
        windows: [win(0, 1_000_000), win(0, 500_000, 'chr2')],
        toMate: true,
      }),
    ).toEqual([
      { refName: 'Pp01', start: 100_000, end: 900_000 },
      { refName: 'Pp02', start: 50_000, end: 450_000 },
    ])
  })

  test('a window with nothing under it answers undefined in place', () => {
    expect(
      followWindowsMapping({
        data: genome,
        windows: [win(0, 500_000, 'chr9'), win(0, 1_000_000)],
        toMate: true,
      }).map(s => s?.refName),
    ).toEqual([undefined, 'Pp01'])
  })

  // the one-pass form has to be the same arithmetic, or the rung it serves
  // would place rows differently from the rung below it
  test('an answer is the same as asking for that window alone', () => {
    const windows = [win(0, 1_000_000), win(0, 500_000, 'chr2')]
    expect(
      followWindowsMapping({ data: genome, windows, toMate: true }),
    ).toEqual(windows.map(w => map(genome, w)))
  })
})

// A GENE TABLE weighs one vote per gene, not anchor bp — the rule the
// multi-way lane and the launch already vote with. Weighed by bp, one 1.5 Mb
// gene outvoted fifteen orthologs totalling a tenth of that, and the followed
// row went to a contig the lane and the launched panel both avoid.
describe('the target vote on a named source', () => {
  // one huge gene against many small ones, mates on different contigs, so the
  // bp axis and the gene-count axis disagree
  const genes = [
    {
      name: 'DPP10',
      start: 1_000_000,
      end: 2_500_000,
      mateRefName: 'Pp2B',
      mateStart: 1_000_000,
      mateEnd: 2_500_000,
    },
    ...Array.from({ length: 15 }, (_, i) => ({
      name: `og${i}`,
      start: 3_000_000 + i * 30_000,
      end: 3_020_000 + i * 30_000,
      mateRefName: 'Pp2A',
      mateStart: 3_000_000 + i * 30_000,
      mateEnd: 3_020_000 + i * 30_000,
    })),
  ]

  test('many small orthologs outvote one long gene', () => {
    expect(map(data(genes), win(500_000, 4_000_000))).toMatchObject({
      refName: 'Pp2A',
    })
  })

  test('the follow, the lane and the launch land on one contig', () => {
    // the launch's twin of the vote above, over the same records spelled as
    // features — the parity `layoutMultiWay.test.ts` pins lane-to-launch,
    // pinned here for the third voter
    const features = genes.map(
      g =>
        new SimpleFeature({
          uniqueId: g.name,
          refName: 'chr1',
          start: g.start,
          end: g.end,
          strand: 1,
          name: g.name,
          assemblyName: 'grape',
          mate: {
            assemblyName: 'peach',
            refName: g.mateRefName,
            start: g.mateStart,
            end: g.mateEnd,
            name: g.name,
          },
        }),
    )
    expect(resolvePanel(features, undefined)!.refName).toBe(
      map(data(genes), win(500_000, 4_000_000))!.refName,
    )
  })

  test('a nameless source still weighs anchor bp', () => {
    // the same shape with no names is an alignment record set, where the long
    // block IS the evidence and must win over the repeat-sized hits
    expect(
      map(
        data(genes.map(({ name, ...rest }) => rest)),
        win(500_000, 4_000_000),
      ),
    ).toMatchObject({ refName: 'Pp2B' })
  })
})

// A FUSION: the anchor's one contig is two of the mate's laid end to end, so a
// window panned across the join moves summed overlap from one target to the
// other and the two are equal at the join itself. Without a margin the vote
// flips there on rounding — and a flip is a jump to another chromosome, run by
// the frame pass on every frame of the pan.
describe('the target vote across a fusion join', () => {
  const fusion = data([
    { start: 0, end: 500_000, mateStart: 0, mateEnd: 500_000 },
    {
      start: 500_000,
      end: 1_000_000,
      mateRefName: 'Pp09',
      mateStart: 0,
      mateEnd: 500_000,
    },
  ])

  const vote = (w: FollowWindow, incumbentTarget?: string) =>
    followWindowMapping({
      data: fusion,
      window: w,
      toMate: true,
      incumbentTarget,
    })?.refName

  test('tips with the summed overlap when nothing is incumbent', () => {
    expect(vote(win(290_000, 700_000))).toBe('Pp01')
    expect(vote(win(310_000, 700_000))).toBe('Pp09')
  })

  test('a 20kb pan does not move the row to another chromosome', () => {
    expect(vote(win(310_000, 700_000), 'Pp01')).toBe('Pp01')
  })

  test('and the margin holds the other way round too', () => {
    expect(vote(win(290_000, 700_000), 'Pp09')).toBe('Pp09')
  })

  test('a window that has really moved onto the other side switches', () => {
    // 5:1 against the incumbent, well past the margin
    expect(vote(win(400_000, 1_000_000), 'Pp01')).toBe('Pp09')
  })

  test('an incumbent the window has left cannot hold the answer', () => {
    // the blocks are all off this window's left end, so the target exists with
    // nothing aligned under the window and must not win on the bias alone
    expect(vote(win(600_000, 700_000), 'Pp01')).toBe('Pp09')
  })

  test('an incumbent no block names is simply not there', () => {
    expect(vote(win(310_000, 700_000), 'Pp22')).toBe('Pp09')
  })
})
