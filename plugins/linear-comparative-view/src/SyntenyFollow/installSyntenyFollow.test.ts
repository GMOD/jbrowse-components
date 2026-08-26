import { bpToOffset, moveTo } from '@jbrowse/core/util/Base1DUtils'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { types } from '@jbrowse/mobx-state-tree'

import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import { followAnchorWindows } from './followAnchorWindow.ts'
import { installSyntenyFollow } from './installSyntenyFollow.ts'
import { requestCigarMap } from './requestCigarMap.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { FeatureBlock } from '../LinearSyntenyDisplay/testUtils.ts'
import type { FollowPair } from './installSyntenyFollow.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

jest.mock('./requestCigarMap.ts', () => ({
  requestCigarMap: jest.fn(() => new Promise(() => {})),
}))

// A UNIT HARNESS, where every other follow test that drives both passes is in
// jbrowse-web. The case needs an assembly with a contig BETWEEN two that map,
// and every volvox fixture is ctgA and ctgB laid next to each other — an
// interval spanning both has no filler in it, so the amplification this file
// exists for is invisible at that scale whatever the rows do.
//
// Nine chromosomes of a megabase each, the same layout in every row, so an
// interval spanning two of them is exactly as many contigs wide as the gap
// between them.
const CONTIG = 1_000_000
const CONTIGS = 9
const WIDTH = 800

// Base1DView is the whole of what the follow reads off a row: the blocks it is
// showing, the layout it can be placed within, and moveTo's two actions. The
// debounce the real `coarseDynamicBlocks` carries is the one thing a test does
// not want.
const Row = Base1DView.views(self => ({
  get coarseDynamicBlocks() {
    return self.dynamicBlocks.contentBlocks
  },
})).actions(self => ({
  // the one LGV action the settled pass reaches, since the rung below the
  // spread navigates rather than positions
  navTo({
    refName,
    start,
    end,
  }: {
    refName: string
    start: number
    end: number
  }) {
    const { displayedRegions } = self
    const lo = bpToOffset({ refName, coord: start, displayedRegions })
    const hi = bpToOffset({ refName, coord: end, displayedRegions })
    if (!lo || !hi) {
      throw new Error('not in this row')
    }
    moveTo(self, lo, hi)
  },
}))

function row(assemblyName: string) {
  const view = Row.create({ bpPerPx: 2500 })
  view.setVolatileWidth(WIDTH)
  view.setDisplayedRegions(
    Array.from({ length: CONTIGS }, (_, i) => ({
      refName: `chr${i + 1}`,
      start: 0,
      end: CONTIG,
      assemblyName,
    })),
  )
  return view
}

function display(blocks: FeatureBlock[], hasCigar = false) {
  return {
    featureData: packSyntenyFeatureData(blocks, { hasCigar }),
  } as LinearSyntenyDisplayModel
}

// A whole contig of one row against a whole contig of the next.
function pairing(refName: string, mateRefName: string) {
  return {
    refName,
    start: 0,
    end: CONTIG,
    mateRefName,
    mateStart: 0,
    mateEnd: CONTIG,
  }
}

const Host = types
  .model('TestSyntenyFollowHost', {})
  .volatile(() => ({
    followSynteny: true,
    followUnaligned: false,
    followApproximate: false,
    followPartial: undefined as
      | { following: string; elsewhere: string[] }
      | undefined,
    followPairs: [] as FollowPair[],
  }))
  .actions(self => ({
    setFollowPairs(pairs: FollowPair[]) {
      self.followPairs = pairs
    },
    setFollowUnaligned(arg: boolean) {
      self.followUnaligned = arg
    },
    setFollowApproximate(arg: boolean) {
      self.followApproximate = arg
    },
    setFollowPartial(
      arg: { following: string; elsewhere: string[] } | undefined,
    ) {
      self.followPartial = arg
    },
  }))

// put the row on an interval of its own layout, in bp
function place(view: ReturnType<typeof row>, start: number, end: number) {
  view.setBpPerPx((end - start) / WIDTH)
  view.scrollTo(Math.round(start / view.bpPerPx))
}

const shown = (view: ReturnType<typeof row>) => [
  ...new Set(view.dynamicBlocks.contentBlocks.map(b => b.refName)),
]

// A CHROMOSOMAL FUSION, which is the shape that puts a row's two answers on
// contigs that are not neighbours: the anchor's chr1 and chr2 are the next
// row's chr1 and chr3, so placing that row on both also puts chr2 on its screen
// — filler, and unavoidable, since a row lays its regions end to end.
//
// The level beyond it is where that matters. Read back off the blocks, the
// filler is a window like any other, and here it has an alignment of its own to
// a chromosome six along.
describe('a spread carried up a three-row stack', () => {
  function stack() {
    const rows = [row('a'), row('b'), row('c')]
    const levels = [
      {
        linearSyntenyDisplays: [
          display([pairing('chr1', 'chr1'), pairing('chr2', 'chr3')]),
        ],
      },
      {
        linearSyntenyDisplays: [
          display([
            pairing('chr1', 'chr1'),
            pairing('chr3', 'chr3'),
            // the filler's own alignment, and the whole of the amplification
            pairing('chr2', 'chr9'),
          ]),
        ],
      },
    ]
    const host = Host.create()
    host.setFollowPairs(
      levels.map((level, i) => ({
        level,
        stayingView: rows[i] as unknown as LinearGenomeViewModel,
        movingView: rows[i + 1] as unknown as LinearGenomeViewModel,
        toMate: true,
      })),
    )
    installSyntenyFollow(host)
    return rows
  }

  test('the middle row is placed across the gap between its two answers', () => {
    const [, middle] = stack()
    expect(shown(middle!)).toEqual(['chr1', 'chr2', 'chr3'])
  })

  test('the far row follows the contigs that mapped, not the ones on screen', () => {
    const [, middle, far] = stack()
    // the middle row really is showing three contigs — the assertion below is
    // about what the level beyond it READS, not about what it displays
    expect(
      followAnchorWindows(middle!.dynamicBlocks.contentBlocks),
    ).toHaveLength(3)
    expect(shown(far!)).toEqual(['chr1', 'chr2', 'chr3'])
  })

  test('the anchor is left where it was', () => {
    const [anchor] = stack()
    expect(shown(anchor!)).toEqual(['chr1', 'chr2'])
  })
})

// The grape/peach/cacao report. A window that runs off the end of one contig
// into the next is an ordinary navigation, and its two answers can be anywhere
// in the moving row — measured live at 13.9Mb of answer inside a 137.6Mb row,
// with two whole chromosomes on screen that nothing reaches. The reader's words
// were "there is nothing that row 1 connects to from there".
describe('a straddle whose answers are far apart', () => {
  function stack(mateOfSecond: string) {
    const rows = [row('a'), row('b')]
    // most of chr1 and the head of chr2, the shape a navigation near a contig
    // end produces on its own
    place(rows[0]!, 200_000, 1_100_000)
    const host = Host.create()
    host.setFollowPairs([
      {
        level: {
          linearSyntenyDisplays: [
            display([pairing('chr1', 'chr1'), pairing('chr2', mateOfSecond)]),
          ],
        },
        stayingView: rows[0] as unknown as LinearGenomeViewModel,
        movingView: rows[1] as unknown as LinearGenomeViewModel,
        toMate: true,
      },
    ])
    installSyntenyFollow(host)
    return { rows, host }
  }

  test('the anchor is reading as two contigs, which is what starts this', () => {
    const { rows } = stack('chr9')
    expect(followAnchorWindows(rows[0]!.coarseDynamicBlocks)).toHaveLength(2)
  })

  test('the row is placed on the contig the reader is on, not across the gap', async () => {
    const { rows, host } = stack('chr9')
    // the settled pass resolves through a promise before it navigates
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(shown(rows[1]!)).toEqual(['chr1'])
    // named, both sides: scrolling the anchor onto chr2 is how the reader sees
    // the answer this refused, and nothing else would tell them it is there
    expect(host.followPartial).toEqual({
      following: 'chr1',
      elsewhere: ['chr2'],
    })
  })

  test('and it spreads as before when the two answers are neighbours', async () => {
    const { rows, host } = stack('chr2')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(shown(rows[1]!)).toEqual(['chr1', 'chr2'])
    expect(host.followPartial).toBeUndefined()
  })
})

function twoRows(displays: LinearSyntenyDisplayModel[]) {
  const rows = [row('a'), row('b')]
  const host = Host.create()
  host.setFollowPairs([
    {
      level: { linearSyntenyDisplays: displays },
      stayingView: rows[0] as unknown as LinearGenomeViewModel,
      movingView: rows[1] as unknown as LinearGenomeViewModel,
      toMate: true,
    },
  ])
  return { rows, host }
}

describe('a window wider than the block it is placed by', () => {
  test("asks for that block's CIGAR map, so a zoom into it has one", async () => {
    jest.mocked(requestCigarMap).mockClear()
    const { rows, host } = twoRows([
      display(
        [
          {
            refName: 'chr1',
            start: 300_000,
            end: 700_000,
            mateRefName: 'chr1',
            mateStart: 300_000,
            mateEnd: 700_000,
          },
        ],
        true,
      ),
    ])
    place(rows[0]!, 0, CONTIG)
    installSyntenyFollow(host)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(host.followApproximate).toBe(true)
    expect(requestCigarMap).toHaveBeenCalledTimes(1)
    expect(jest.mocked(requestCigarMap).mock.calls[0]![0].feat).toMatchObject({
      refName: 'chr1',
      start: 300_000,
      end: 700_000,
    })
  })
})

describe('a whole-genome row zoomed by hand', () => {
  test('is put back on the next pass rather than on the next fetch', async () => {
    const { rows, host } = twoRows([
      display(
        Array.from({ length: CONTIGS }, (_, i) =>
          pairing(`chr${i + 1}`, `chr${i + 1}`),
        ),
      ),
    ])
    place(rows[0]!, 0, CONTIG * CONTIGS)
    installSyntenyFollow(host)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(shown(rows[1]!)).toHaveLength(CONTIGS)
    place(rows[1]!, 0, CONTIG)
    // no fetch key in this harness: only a tracked read of the moving row's
    // blocks can wake the pass
    expect(shown(rows[1]!)).toHaveLength(CONTIGS)
  })
})
