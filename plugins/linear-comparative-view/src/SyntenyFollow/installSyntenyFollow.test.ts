import {
  bpToOffset,
  compareBpOffsets,
  moveTo,
} from '@jbrowse/core/util/Base1DUtils'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import { followAnchorWindows } from './followAnchorWindow.ts'
import { installSyntenyFollow } from './installSyntenyFollow.ts'
import { requestCigarMap } from './requestCigarMap.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { FeatureBlock } from '../LinearSyntenyDisplay/testUtils.ts'
import type { FollowPair } from './installSyntenyFollow.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { NotificationLevel, SnackAction } from '@jbrowse/core/util/types'
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
// debounce the real `coarseDynamicBlocks` carries is the one thing most of
// these tests do not want — so the two clocks run together until a test calls
// `holdCoarseBlocks`, which latches them where they are and leaves later
// placements moving the live ones alone. That is a drag between settles, which
// is the only state the frame pass can be seen in.
const Row = Base1DView.volatile(() => ({
  heldBlocks: undefined as ContentBlock[] | undefined,
}))
  .views(self => ({
    get coarseDynamicBlocks() {
      return self.heldBlocks ?? self.dynamicBlocks.contentBlocks
    },
    get displayedRegionsOrientation() {
      const first = !!self.displayedRegions[0]?.reversed
      return self.displayedRegions.every(r => !!r.reversed === first)
        ? first
          ? 'reversed'
          : 'forward'
        : 'mixed'
    },
  }))
  .actions(self => ({
    holdCoarseBlocks() {
      self.heldBlocks = [...self.dynamicBlocks.contentBlocks]
    },
    horizontallyFlip() {
      self.setDisplayedRegions(
        [...self.displayedRegions]
          .reverse()
          .map(region => ({ ...region, reversed: !region.reversed })),
      )
      self.scrollTo(self.displayedRegionsTotalPx - self.offsetPx - self.width)
    },
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
      const a = bpToOffset({ refName, coord: start, displayedRegions })
      const b = bpToOffset({ refName, coord: end, displayedRegions })
      if (!a || !b) {
        throw new Error('not in this row')
      }
      // ORDERED, which is what `resolveNavEndpoint` does with `r.reversed` and
      // what `spanBounds` does with `compareBpOffsets`: a reversed region puts
      // a span's end left of its start, and `moveTo` computes a negative
      // bpPerPx from a backwards pair rather than refusing
      const backwards = compareBpOffsets(a, b) > 0
      moveTo(self, backwards ? b : a, backwards ? a : b)
    },
    // navTo's fallback, which is what the follow reaches for a span on a contig
    // the row is not displaying: `showRegions` with the one region the
    // locstring named, and a bare locstring names no orientation
    // eslint-disable-next-line @typescript-eslint/require-await
    async navToLocString(locString: string) {
      const [refName, range] = locString.split(':')
      const [start, end] = range!.split('-').map(Number)
      const { assemblyName } = self.displayedRegions[0]!
      self.setDisplayedRegions([
        { refName: refName!, start: 0, end: CONTIG, assemblyName },
      ])
      const { displayedRegions } = self
      moveTo(
        self,
        bpToOffset({ refName: refName!, coord: start!, displayedRegions }),
        bpToOffset({ refName: refName!, coord: end!, displayedRegions }),
      )
      return true
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

// an MST node, since the frame pass asks `isAlive` of the display it picked
const Display = types
  .model('TestSyntenyDisplay', {})
  .volatile(() => ({ featureData: undefined as unknown }))
  .actions(self => ({
    setFeatureData(data: unknown) {
      self.featureData = data
    },
  }))

function display(blocks: FeatureBlock[], hasCigar = false) {
  const node = Display.create()
  node.setFeatureData(packSyntenyFeatureData(blocks, { hasCigar }))
  return node as unknown as LinearSyntenyDisplayModel
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
    followMatchOrientation: true,
    followUnaligned: false,
    followApproximate: false,
    followAnchorIndex: 0,
    followPartial: undefined as
      | { following: string; elsewhere: string[] }
      | undefined,
    followPairs: [] as FollowPair[],
    views: [] as { assemblyNames: string[] }[],
  }))
  .actions(self => ({
    setFollowPairs(pairs: FollowPair[]) {
      self.followPairs = pairs
    },
    setViews(views: { assemblyNames: string[] }[]) {
      self.views = views
    },
    setFollowMatchOrientation(arg: boolean) {
      self.followMatchOrientation = arg
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
    setFollowAnchorIndex(idx: number) {
      self.followAnchorIndex = idx
    },
    setRowSyncMode(mode: 'independent' | 'link' | 'follow') {
      self.followSynteny = mode === 'follow'
    },
  }))

// `getNotificationSink` walks to the first parent carrying `rpcManager` and
// `configuration`
const Session = types
  .model('TestSyntenyFollowSession', { host: Host })
  .volatile(() => ({
    rpcManager: {},
    configuration: {},
    notifications: [] as { message: string; actions: SnackAction[] }[],
  }))
  .actions(self => ({
    notify(
      message: string,
      _level?: NotificationLevel,
      action?: SnackAction | SnackAction[],
    ) {
      self.notifications.push({
        message,
        actions: action ? (Array.isArray(action) ? action : [action]) : [],
      })
    },
    notifyError(message: string) {
      throw new Error(message)
    },
  }))

function hostFor(assemblies = ['a', 'b', 'c']) {
  const session = Session.create({ host: {} })
  session.host.setViews(assemblies.map(name => ({ assemblyNames: [name] })))
  return session.host
}

const notificationsOf = (node: ReturnType<typeof hostFor>) =>
  getParent<{ notifications: { message: string; actions: SnackAction[] }[] }>(
    node,
  ).notifications

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
    const host = hostFor()
    host.setFollowPairs(
      levels.map((level, i) => ({
        level,
        stayingView: rows[i] as unknown as LinearGenomeViewModel,
        movingView: rows[i + 1] as unknown as LinearGenomeViewModel,
        toMate: true,
        movingIndex: i + 1,
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
    const host = hostFor()
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
        movingIndex: 1,
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

  // The refusal's own advice, taken. `state.spread` is written only by the
  // multi-contig rung, which a one-contig panel does not reach, so the report
  // outlived the panel it was about: the header went on naming chr1 and telling
  // the reader to scroll onto chr2 while they were already there — and the row
  // really was following chr2, by the fallback below the rung.
  test('scrolling onto the contig it named stops naming it', async () => {
    const { rows, host } = stack('chr9')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(host.followPartial).toEqual({
      following: 'chr1',
      elsewhere: ['chr2'],
    })

    place(rows[0]!, 1_100_000, 1_500_000)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(followAnchorWindows(rows[0]!.coarseDynamicBlocks)).toHaveLength(1)
    // the row really is following chr2 now — chr9 is what chr2 maps to
    expect(shown(rows[1]!)).toEqual(['chr9'])
    expect(host.followPartial).toBeUndefined()
  })

  test('and it spreads as before when the two answers are neighbours', async () => {
    const { rows, host } = stack('chr2')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(shown(rows[1]!)).toEqual(['chr1', 'chr2'])
    expect(host.followPartial).toBeUndefined()
  })

  // The refusal is measured over a window set, so it dies with it. Zoomed into
  // one contig the rung is out of reach, nothing re-decides, and a refusal left
  // standing went on naming a region the anchor no longer spans — ahead of
  // `approximate` in the header's wording, so it was also the sentence the
  // reader saw.
  test('the report clears once the anchor is back on one contig', async () => {
    const { rows, host } = stack('chr9')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(host.followPartial).toBeDefined()
    place(rows[0]!, 200_000, 600_000)
    expect(followAnchorWindows(rows[0]!.coarseDynamicBlocks)).toHaveLength(1)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(host.followPartial).toBeUndefined()
  })

  // The frame pass follows the settle's DECISION, not its window: the decision
  // names a contig, and half a second of drag can carry that contig off screen.
  // Frozen there, the row stopped following for the rest of the drag.
  test('the row keeps following when the kept contig scrolls away mid-drag', async () => {
    const rows = [row('a'), row('b')]
    const host = hostFor()
    host.setFollowPairs([
      {
        level: {
          linearSyntenyDisplays: [
            display([
              pairing('chr1', 'chr1'),
              pairing('chr2', 'chr9'),
              pairing('chr3', 'chr3'),
            ]),
          ],
        },
        stayingView: rows[0] as unknown as LinearGenomeViewModel,
        movingView: rows[1] as unknown as LinearGenomeViewModel,
        toMate: true,
        movingIndex: 1,
      },
    ])
    place(rows[0]!, 200_000, 1_100_000)
    rows[0]!.holdCoarseBlocks()
    installSyntenyFollow(host)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(host.followPartial).toEqual({
      following: 'chr1',
      elsewhere: ['chr2'],
    })
    expect(shown(rows[1]!)).toEqual(['chr1'])

    place(rows[0]!, 1_200_000, 2_100_000)
    expect(shown(rows[0]!)).toEqual(['chr2', 'chr3'])
    // chr2's own answer, which is where the widest window now points
    expect(shown(rows[1]!)).toEqual(['chr9'])
  })
})

function twoRows(displays: LinearSyntenyDisplayModel[]) {
  const rows = [row('a'), row('b')]
  const host = hostFor()
  host.setFollowPairs([
    {
      level: { linearSyntenyDisplays: displays },
      stayingView: rows[0] as unknown as LinearGenomeViewModel,
      movingView: rows[1] as unknown as LinearGenomeViewModel,
      toMate: true,
      movingIndex: 1,
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
  async function wholeGenome() {
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
    return { rows, host }
  }

  test('is put back on the next pass rather than on the next fetch', async () => {
    const { rows } = await wholeGenome()
    expect(shown(rows[1]!)).toHaveLength(CONTIGS)
    place(rows[1]!, 0, CONTIG)
    // no fetch key in this harness: only a tracked read of the moving row's
    // blocks can wake the pass
    expect(shown(rows[1]!)).toHaveLength(CONTIGS)
  })

  test('says so, once, naming both rows', async () => {
    const { rows, host } = await wholeGenome()
    expect(notificationsOf(host)).toHaveLength(0)
    place(rows[1]!, 0, CONTIG)
    expect(notificationsOf(host).map(n => n.message)).toEqual([
      'b is following a, so it moved back to the matching region',
    ])
    place(rows[1]!, CONTIG, CONTIG * 2)
    expect(notificationsOf(host)).toHaveLength(1)
  })

  test('an anchor pan places the row and reports nothing', async () => {
    const { rows, host } = await wholeGenome()
    place(rows[0]!, 0, CONTIG * 3)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(shown(rows[1]!)).toEqual(['chr1', 'chr2', 'chr3'])
    expect(notificationsOf(host)).toHaveLength(0)
  })

  test('the message offers to anchor the row that was moved', async () => {
    const { rows, host } = await wholeGenome()
    place(rows[1]!, 0, CONTIG)
    const [anchorHere] = notificationsOf(host)[0]!.actions
    expect(anchorHere!.name).toBe('Anchor this row')
    anchorHere!.onClick()
    expect(host.followAnchorIndex).toBe(1)
  })

  test('and to stop following', async () => {
    const { rows, host } = await wholeGenome()
    place(rows[1]!, 0, CONTIG)
    const [, stop] = notificationsOf(host)[0]!.actions
    expect(stop!.name).toBe('Stop following')
    stop!.onClick()
    expect(host.followSynteny).toBe(false)
  })
})

// the other rung, which navigates rather than positions
describe('a row nudged off a single-contig answer', () => {
  const settle = () => new Promise(resolve => setTimeout(resolve, 0))

  async function placed() {
    const { rows, host } = twoRows([
      display([
        {
          refName: 'chr1',
          start: 300_000,
          end: 700_000,
          mateRefName: 'chr1',
          mateStart: 300_000,
          mateEnd: 700_000,
        },
      ]),
    ])
    place(rows[0]!, 0, CONTIG)
    installSyntenyFollow(host)
    await settle()
    await settle()
    return { rows, host }
  }

  test('is reported, having been put back', async () => {
    const { rows, host } = await placed()
    expect(notificationsOf(host)).toHaveLength(0)
    const before = rows[1]!.offsetPx
    place(rows[1]!, 0, CONTIG * CONTIGS)
    await settle()
    await settle()
    expect(rows[1]!.offsetPx).toBe(before)
    expect(notificationsOf(host).map(n => n.message)).toEqual([
      'b is following a, so it moved back to the matching region',
    ])
  })

  test('an anchor pan is not', async () => {
    const { rows, host } = await placed()
    place(rows[0]!, 100_000, CONTIG)
    await settle()
    await settle()
    expect(notificationsOf(host)).toHaveLength(0)
  })
})

const reversedOf = (view: ReturnType<typeof row>) =>
  !!view.dynamicBlocks.contentBlocks[0]?.reversed

describe('orientation', () => {
  const inverted = {
    refName: 'chr1',
    start: 300_000,
    end: 700_000,
    mateRefName: 'chr1',
    mateStart: 300_000,
    mateEnd: 700_000,
    strand: -1,
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 0))

  test('inside an inverted alignment the row is turned round, once', async () => {
    const { rows, host } = twoRows([display([inverted])])
    place(rows[0]!, 400_000, 600_000)
    installSyntenyFollow(host)
    await settle()
    expect(reversedOf(rows[1]!)).toBe(true)
    // the user's own flip stands until the decision changes
    rows[1]!.horizontallyFlip()
    place(rows[0]!, 410_000, 610_000)
    await settle()
    expect(reversedOf(rows[1]!)).toBe(false)
  })

  test('a reversed anchor inside an inverted alignment wants a forward row', async () => {
    const { rows, host } = twoRows([display([inverted])])
    rows[0]!.horizontallyFlip()
    place(rows[0]!, 400_000, 600_000)
    installSyntenyFollow(host)
    await settle()
    expect(reversedOf(rows[1]!)).toBe(false)
  })

  test('a window over nearly all inverted ribbons is turned round, a mixed one is not', async () => {
    const ortholog = (start: number, strand: number) => ({
      refName: 'chr1',
      start,
      end: start + 10_000,
      mateRefName: 'chr1',
      mateStart: start,
      mateEnd: start + 10_000,
      strand,
    })
    const mostly = twoRows([
      display(
        Array.from({ length: 20 }, (_, i) =>
          ortholog(i * 40_000, i === 0 ? 1 : -1),
        ),
      ),
    ])
    place(mostly.rows[0]!, 0, CONTIG)
    installSyntenyFollow(mostly.host)
    await settle()
    expect(reversedOf(mostly.rows[1]!)).toBe(true)

    const mixed = twoRows([
      display(
        Array.from({ length: 20 }, (_, i) =>
          ortholog(i * 40_000, i % 2 ? 1 : -1),
        ),
      ),
    ])
    place(mixed.rows[0]!, 0, CONTIG)
    installSyntenyFollow(mixed.host)
    await settle()
    expect(reversedOf(mixed.rows[1]!)).toBe(false)
  })

  test('off, nothing turns', async () => {
    const { rows, host } = twoRows([display([inverted])])
    host.setFollowMatchOrientation(false)
    place(rows[0]!, 400_000, 600_000)
    installSyntenyFollow(host)
    await settle()
    expect(reversedOf(rows[1]!)).toBe(false)
  })

  test('turning it on turns the row round without waiting for a pan', async () => {
    const { rows, host } = twoRows([display([inverted])])
    host.setFollowMatchOrientation(false)
    place(rows[0]!, 400_000, 600_000)
    installSyntenyFollow(host)
    await settle()
    expect(reversedOf(rows[1]!)).toBe(false)

    host.setFollowMatchOrientation(true)
    await settle()
    expect(reversedOf(rows[1]!)).toBe(true)
  })

  test('a row navigated onto another contig lands turned round', async () => {
    const onChr2 = { ...inverted, refName: 'chr2', mateRefName: 'chr2' }
    const { rows, host } = twoRows([display([onChr2])])
    // the row displays ONE contig, so the span's own contig is out of reach of
    // navTo and the follow takes navToLocString's region replacement
    rows[1]!.setDisplayedRegions([
      { refName: 'chr1', start: 0, end: CONTIG, assemblyName: 'b' },
    ])
    place(rows[0]!, 1_400_000, 1_600_000)
    installSyntenyFollow(host)
    await settle()
    expect(shown(rows[1]!)).toEqual(['chr2'])
    expect(reversedOf(rows[1]!)).toBe(true)
  })

  test('a row with one region reversed by hand is left alone', async () => {
    const { rows, host } = twoRows([display([inverted])])
    rows[1]!.setDisplayedRegions(
      rows[1]!.displayedRegions.map((r, i) =>
        i === 3 ? { ...r, reversed: true } : { ...r },
      ),
    )
    place(rows[0]!, 400_000, 600_000)
    installSyntenyFollow(host)
    await settle()
    // the follow really did place it — the assertion below is that it declined
    // to turn it, not that it never got there
    expect(shown(rows[1]!)).toEqual(['chr1'])
    // flipping a mixed row flips every region at once, which is a bigger edit
    // than the follow is entitled to make
    expect(rows[1]!.displayedRegions.map(r => !!r.reversed)).toEqual(
      Array.from({ length: CONTIGS }, (_, i) => i === 3),
    )
  })

  test('the vote is over the contig that places the row, not every contig under the window', async () => {
    const ribbon = (mateRefName: string, start: number, strand: number) => ({
      refName: 'chr1',
      start,
      end: start + 20_000,
      mateRefName,
      mateStart: start,
      mateEnd: start + 20_000,
      strand,
    })
    // chr5 takes the row, on 200kb of inverted alignment; chr6's forward 160kb
    // is on a contig the row is not placed on
    const { rows, host } = twoRows([
      display([
        ...Array.from({ length: 10 }, (_, i) => ribbon('chr5', i * 40_000, -1)),
        ...Array.from({ length: 8 }, (_, i) =>
          ribbon('chr6', 400_000 + i * 40_000, 1),
        ),
      ]),
    ])
    place(rows[0]!, 0, CONTIG)
    installSyntenyFollow(host)
    await settle()
    expect(shown(rows[1]!)).toEqual(['chr5'])
    expect(reversedOf(rows[1]!)).toBe(true)
  })
})
