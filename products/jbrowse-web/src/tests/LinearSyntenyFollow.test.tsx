import { getSession } from '@jbrowse/core/util'
import { waitFor } from '@testing-library/react'

import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = { timeout: 30000 }

// volvox_inv_indels.paf, query volvox_random_inv -> target volvox, all seven
// rows on ctgA and all carrying CIGARs. The row this exercises aligns query
// 26805..49184 to target 27258..50001, so a query window inside it has an
// answer roughly 450bp to its right on the target, and windows to the left of
// 26805 fall in a stretch a different row covers.
const QUERY_ASM = 'volvox_random_inv'
const TARGET_ASM = 'volvox'

interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  levels: { linearSyntenyDisplays: { featureData?: unknown }[] }[]
  followApproximate: boolean
  followUnaligned: boolean
  setWidth: (n: number) => void
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
  setFollowAnchorIndex: (idx: number) => void
}

async function openSyntenyView() {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: QUERY_ASM }, { assembly: TARGET_ASM }],
      tracks: ['volvox_inv_indels'],
    },
  }) as unknown as SyntenyView
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, timeout)
  const display = view.levels[0]!.linearSyntenyDisplays[0]!
  await waitFor(() => {
    expect(display.featureData).toBeDefined()
  }, timeout)
  return view
}

// The visible span of a row, as the follow itself reads it.
function windowOf(lgv: LinearGenomeViewModel) {
  const blocks = lgv.dynamicBlocks.contentBlocks
  return {
    refName: blocks[0]?.refName,
    start: Math.min(...blocks.map(b => b.start)),
    end: Math.max(...blocks.map(b => b.end)),
  }
}

test('the target row is left alone until following is turned on', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  const before = windowOf(target!)

  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  // long enough to cover the coarse-blocks debounce the follow waits on, so
  // this is "it did not move", not "it has not moved yet"
  await new Promise(resolve => setTimeout(resolve, 1500))

  expect(windowOf(target!)).toEqual(before)
})

test('following sends the target row to the region that aligns to the query', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)

  await waitFor(() => {
    const win = windowOf(target!)
    expect(win.refName).toBe('ctgA')
    // the alignment offsets this stretch by ~450bp; the assertion is loose
    // enough to survive the indels inside it and tight enough that a row left
    // where it started (or sent to the whole block, 27258..50001) fails
    expect(win.start).toBeGreaterThan(29500)
    expect(win.end).toBeLessThan(32000)
  }, timeout)
})

test('the followed row tracks the anchor as it pans, rather than jumping once', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).start).toBeGreaterThan(29500)
  }, timeout)

  await query!.navToLocString('ctgA:40000..41000', QUERY_ASM)
  await waitFor(() => {
    const win = windowOf(target!)
    expect(win.start).toBeGreaterThan(39500)
    expect(win.end).toBeLessThan(42500)
  }, timeout)
})

// Reported from the grape/peach MCScan demo and reproduced there at 2131x: a
// window wider than any one alignment resolved through whichever single block
// overlapped it most, and since both single-block resolvers CLAMP the window to
// the block, the followed row zoomed to that block's own width. The wider the
// anchor, the worse it got. volvox_inv_indels puts seven blocks on ctgA, the
// widest 22kb of a 49kb contig, so a whole-contig window is the same shape of
// problem an order of magnitude smaller.
test('a window wider than any one alignment does not zoom the followed row in', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  // ZOOM IN FIRST. The target row opens on the whole genome, which is already
  // wider than anything asserted below — so without this the test passes on a
  // row the follow never touched, which is exactly how it read before this
  // line was here.
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).end - windowOf(target!).start).toBeLessThan(5000)
  }, timeout)

  await query!.navToLocString('ctgA:1..49186', QUERY_ASM)

  await waitFor(() => {
    // the single-block answer is the widest block's own 22.7kb; the union of
    // everything under the window covers nearly the whole 50kb contig
    const followed = windowOf(target!)
    expect(followed.end - followed.start).toBeGreaterThan(35000)
  }, timeout)
})

// The envelope and the CIGAR walk place a row identically as far as the screen
// is concerned, so a view zoomed out past one alignment used to report itself
// as following exactly.
test('the view says when a placement was proportional rather than walked', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  // inside one alignment, and this file's rows all carry CIGARs
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).start).toBeGreaterThan(29500)
  }, timeout)
  expect(view.followApproximate).toBe(false)

  // wider than any one alignment, so the answer is now the envelope
  await query!.navToLocString('ctgA:1..49186', QUERY_ASM)
  await waitFor(() => {
    expect(view.followApproximate).toBe(true)
  }, timeout)

  // and it is not a latch — zooming back inside one alignment reports exact again
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(view.followApproximate).toBe(false)
  }, timeout)
})

test('switching the mode off clears what the follow was reporting', async () => {
  const view = await openSyntenyView()
  const [query] = view.views
  view.setRowSyncMode('follow')

  await query!.navToLocString('ctgA:1..49186', QUERY_ASM)
  await waitFor(() => {
    expect(view.followApproximate).toBe(true)
  }, timeout)

  view.setRowSyncMode('independent')
  expect(view.followApproximate).toBe(false)
})

// The complaint this answers is about MOTION, not accuracy. The exact resolve
// costs an RPC and reads the debounced window, so on its own the followed row
// sits perfectly still through a drag and then jumps ~500ms after it ends — it
// never moves WITH the anchor, only after it, which reads as jumpy however
// correct each jump is. A cached local transform lets the per-frame pass place
// the row between resolves.
test('the followed row moves during a pan, not only after it settles', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  // one settled resolve, which is what caches the transform
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).start).toBeGreaterThan(29500)
  }, timeout)

  // now pan in small steps with NO waiting between them. Nothing debounced can
  // have run, so any movement here is the per-frame pass.
  const positions: number[] = [target!.offsetPx]
  for (let i = 0; i < 5; i++) {
    query!.horizontalScroll(40)
    positions.push(target!.offsetPx)
  }

  // strictly increasing: it tracked every step rather than moving once
  for (let i = 1; i < positions.length; i++) {
    expect(positions[i]!).toBeGreaterThan(positions[i - 1]!)
  }
})

test('a followed row dragged away by hand is put back', async () => {
  // The guard against redundant navigation compares against where the row
  // ACTUALLY is, not against what the follow last asked for. Remembering only
  // its own request left a hand-nudged row sitting there, with following still
  // reported as on — the mode silently not doing the one thing it is named for.
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).start).toBeGreaterThan(29500)
  }, timeout)

  // far enough to cross the snapped fetch window, which is what wakes the
  // follow again without the anchor having moved
  await target!.navToLocString('ctgA:10000..11000', TARGET_ASM)

  await waitFor(() => {
    const win = windowOf(target!)
    expect(win.start).toBeGreaterThan(29500)
    expect(win.end).toBeLessThan(32000)
  }, timeout)
})

// The exact pass reads the MOVED row's debounced window too, and
// `navToLocString` flushes it — so applying an answer wakes the pass that
// produced it, and the moved row's own refetch wakes it again. Both used to
// walk the same CIGAR a second time to place a row already sitting on it.
test('an answer the follow has just applied is not resolved a second time', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).start).toBeGreaterThan(29500)
  }, timeout)

  const call = jest.spyOn(getSession(query!).rpcManager, 'call')
  await query!.navToLocString('ctgA:40000..41000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).start).toBeGreaterThan(39500)
  }, timeout)
  // long enough that every pass this move woke has run
  await new Promise(resolve => setTimeout(resolve, 1500))

  expect(
    call.mock.calls.filter(c => c[1] === 'SyntenyResolveMatchingRegion'),
  ).toHaveLength(1)
})

// A resolve is an RPC, and the mode can be switched off while one is in flight.
// The latest-wins guard does not cover that: switching off issues no resolve of
// its own, so nothing bumps the sequence the in-flight one checks against, and
// the row moved once more after the user had already stopped the follow.
test('a resolve landing after the mode is switched off does not move the row', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  const { rpcManager } = getSession(query!)
  const inner = rpcManager.call.bind(rpcManager)
  let release: (() => void) | undefined
  jest
    .spyOn(rpcManager, 'call')
    .mockImplementation(async (sessionId, functionName, args) => {
      if (functionName === 'SyntenyResolveMatchingRegion') {
        await new Promise<void>(resolve => {
          release = resolve
        })
      }
      return inner(sessionId, functionName, args)
    })

  view.setRowSyncMode('follow')
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(release).toBeDefined()
  }, timeout)
  // nothing has placed the row yet: the frame pass steers by what a completed
  // resolve caches, and this one is being held open
  const held = windowOf(target!)

  view.setRowSyncMode('independent')
  release!()
  await new Promise(resolve => setTimeout(resolve, 1500))

  expect(windowOf(target!)).toEqual(held)
})

// The same in-flight resolve, against the other way a pass can decide the rows
// hold. Only a pass that HAD something to resolve used to bump the sequence, so
// the pass that lights `followUnaligned` — the one whose whole claim is that
// the rows are holding — let the previous window's answer through underneath it.
test('a resolve landing after the anchor has left every alignment does not move the row', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  const { rpcManager } = getSession(query!)
  const inner = rpcManager.call.bind(rpcManager)
  let release: (() => void) | undefined
  jest
    .spyOn(rpcManager, 'call')
    .mockImplementation(async (sessionId, functionName, args) => {
      if (functionName === 'SyntenyResolveMatchingRegion') {
        await new Promise<void>(resolve => {
          release = resolve
        })
      }
      return inner(sessionId, functionName, args)
    })

  view.setRowSyncMode('follow')
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(release).toBeDefined()
  }, timeout)
  const held = windowOf(target!)

  // query 15925..16409 is this file's widest unaligned gap, so a window well
  // inside it has no answer at all and both rows are meant to stay put
  await query!.navToLocString('ctgA:16100..16250', QUERY_ASM)
  await waitFor(() => {
    expect(view.followUnaligned).toBe(true)
  }, timeout)

  release!()
  await new Promise(resolve => setTimeout(resolve, 1500))

  expect(windowOf(target!)).toEqual(held)
})

test('anchoring the bottom row reverses which row moves', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')
  view.setFollowAnchorIndex(1)

  await target!.navToLocString('ctgA:30000..31000', TARGET_ASM)

  await waitFor(() => {
    const win = windowOf(query!)
    expect(win.refName).toBe('ctgA')
    // the mapping run the other way: ~450bp to the LEFT this time
    expect(win.start).toBeGreaterThan(28500)
    expect(win.end).toBeLessThan(31000)
  }, timeout)
})

// A PanSN file whose loaded set spans three assemblies, where the pair a level
// is about is decided by the level's own two rows rather than by the track.
// Worth an end-to-end case: the follow scans whatever the fetch returned, so
// "the mates are all the ones this level is about" is an assumption about the
// adapter, not something the scan itself can see.
//
// It doubles as the proof that the CIGAR is WALKED rather than interpolated
// across, because this alignment makes the two answers far apart. volvox_ins
// ctgA is 54801bp against volvox's 50001, but the difference is not spread out —
// the CIGAR is 31198M 4800I 18803M, one insertion at 31198. So the first third
// of the contig maps 1:1 and everything after it is offset by 4800, while
// interpolation would stretch the whole thing by 54801/50001 and be ~2.6kb wrong
// at the first locus below and ~1.3kb wrong at the second, in opposite
// directions.
test('following an all-vs-all track walks the CIGAR rather than scaling the block', async () => {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox_ins' }, { assembly: 'volvox' }],
      tracks: ['volvox_all_vs_all'],
    },
  }) as unknown as SyntenyView
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, timeout)
  const display = view.levels[0]!.linearSyntenyDisplays[0]!
  await waitFor(() => {
    expect(display.featureData).toBeDefined()
  }, timeout)

  const [ins, volvox] = view.views
  view.setRowSyncMode('follow')

  // before the insertion: 1:1, where scaling the block would say ~27.4kb
  await ins!.navToLocString('ctgA:30000..31000', 'volvox_ins')
  await waitFor(() => {
    const win = windowOf(volvox!)
    expect(win.refName).toBe('ctgA')
    expect(win.start).toBeGreaterThan(29900)
    expect(win.end).toBeLessThan(31100)
  }, timeout)

  // after it: offset by the 4800bp insert, where scaling would say ~36.5kb
  await ins!.navToLocString('ctgA:40000..41000', 'volvox_ins')
  await waitFor(() => {
    const win = windowOf(volvox!)
    expect(win.start).toBeGreaterThan(35100)
    expect(win.end).toBeLessThan(36300)
  }, timeout)
}, 60000)

// Three rows, where a row two levels from the anchor is placed from a row that
// is itself being placed. Every test above uses two.
//
// These do NOT cover the ORDER the levels are visited in: a follow visiting
// them in level order still converges a pass later, which neither waitFor nor a
// monotonic scroll probe can see. That stays on `followDistance` in
// followDirection.test.ts.
//
// volvox_all_vs_all holds all three pairs and its adapter indexes both sides of
// each record, so one track serves both levels either way round. volvox_del is
// 45141bp against volvox's 50001 (28498M 4860D 16643M) and volvox_ins is 54801
// against the same 50001 (31198M 4800I 18803M), so 30000 on volvox_del is 34860
// on volvox and 39660 on volvox_ins.
const DEL_LOCUS = 30000
const VOLVOX_LOCUS = 34860
const INS_LOCUS = 39660

async function openThreeRowView() {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { assembly: 'volvox_ins' },
        { assembly: 'volvox' },
        { assembly: 'volvox_del' },
      ],
      tracks: [['volvox_all_vs_all'], ['volvox_all_vs_all']],
    },
  }) as unknown as SyntenyView
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, timeout)
  await waitFor(() => {
    for (const level of view.levels) {
      expect(level.linearSyntenyDisplays[0]!.featureData).toBeDefined()
    }
  }, timeout)
  return view
}

// The longest chain a three-row stack has, asserted settled and then again
// under the per-frame pass: a chain only the exact pass carries would leave the
// far row still through a drag.
test('anchoring the bottom row carries the follow up two levels', async () => {
  const view = await openThreeRowView()
  const [ins, volvox, del] = view.views
  view.setRowSyncMode('follow')
  view.setFollowAnchorIndex(2)

  await del!.navToLocString(
    `ctgA:${DEL_LOCUS}..${DEL_LOCUS + 1000}`,
    'volvox_del',
  )

  await waitFor(() => {
    const mid = windowOf(volvox!)
    expect(mid.refName).toBe('ctgA')
    expect(mid.start).toBeGreaterThan(VOLVOX_LOCUS - 500)
    expect(mid.end).toBeLessThan(VOLVOX_LOCUS + 1500)
    // the row two levels out, which is the whole point of the case
    const top = windowOf(ins!)
    expect(top.start).toBeGreaterThan(INS_LOCUS - 500)
    expect(top.end).toBeLessThan(INS_LOCUS + 1500)
  }, timeout)

  // no awaiting between the steps, so nothing debounced can have run and every
  // position here comes from the per-frame pass
  const top: number[] = [ins!.offsetPx]
  const mid: number[] = [volvox!.offsetPx]
  for (let i = 0; i < 5; i++) {
    del!.horizontalScroll(40)
    top.push(ins!.offsetPx)
    mid.push(volvox!.offsetPx)
  }
  for (let i = 1; i < top.length; i++) {
    expect(mid[i]!).toBeGreaterThan(mid[i - 1]!)
    expect(top[i]!).toBeGreaterThan(top[i - 1]!)
  }
}, 60000)

// One level in each direction at once — the only case exercising both values of
// `toMate` against a single anchor.
test('anchoring the middle row drives both neighbours outward', async () => {
  const view = await openThreeRowView()
  const [ins, volvox, del] = view.views
  view.setRowSyncMode('follow')
  view.setFollowAnchorIndex(1)

  await volvox!.navToLocString(
    `ctgA:${VOLVOX_LOCUS}..${VOLVOX_LOCUS + 1000}`,
    'volvox',
  )

  await waitFor(() => {
    const top = windowOf(ins!)
    expect(top.start).toBeGreaterThan(INS_LOCUS - 500)
    expect(top.end).toBeLessThan(INS_LOCUS + 1500)
    const bottom = windowOf(del!)
    expect(bottom.start).toBeGreaterThan(DEL_LOCUS - 500)
    expect(bottom.end).toBeLessThan(DEL_LOCUS + 1500)
  }, timeout)
}, 60000)

// A follow that cannot resolve cannot resolve repeatedly, so it says so once.
// The slot holding that was one per VIEW, and with two levels the one that
// resolves fine cleared it every pass and the one that never will reported
// itself again behind it. Nothing downstream absorbs the repeats either:
// `notifyError` always attaches a `report` action, and an actionable snackbar
// is exactly what bypasses the snackbar model's own message dedup.
test('a level that can never resolve reports itself once, not once a settle', async () => {
  const view = await openThreeRowView()
  const [ins, volvox] = view.views
  const session = getSession(ins!) as unknown as {
    snackbarMessages: { message: string }[]
  }
  const { rpcManager } = getSession(ins!)
  const inner = rpcManager.call.bind(rpcManager)
  jest
    .spyOn(rpcManager, 'call')
    .mockImplementation(async (sessionId, functionName, args) => {
      // the LOWER level's resolve, named by the query axis it walks — the upper
      // one asks about volvox_ins and goes through untouched
      const { regions } = args as { regions?: { assemblyName: string }[] }
      if (
        functionName === 'SyntenyResolveMatchingRegion' &&
        regions?.[0]?.assemblyName === 'volvox'
      ) {
        throw new Error('this level cannot resolve')
      }
      return inner(sessionId, functionName, args)
    })

  view.setRowSyncMode('follow')
  for (const locus of [INS_LOCUS, INS_LOCUS + 3000, INS_LOCUS + 6000]) {
    await ins!.navToLocString(`ctgA:${locus}..${locus + 1000}`, 'volvox_ins')
    // the working level placing its row is what proves the pass ran at all,
    // and it is also the success that used to clear the failing level's slot
    await waitFor(() => {
      expect(windowOf(volvox!).start).toBeGreaterThan(locus - 5000)
    }, timeout)
  }
  await new Promise(resolve => setTimeout(resolve, 1500))

  expect(
    session.snackbarMessages.filter(m =>
      m.message.includes('this level cannot resolve'),
    ),
  ).toHaveLength(1)
}, 60000)

// A LOCKED TAB, not a slow one: this pegged one core at 90% with ~1.4 GB
// resident, indefinitely, and jest's own timeout never fired because the loop
// starves the timer queue.
//
// `volvox_del.paf` declares rows ["volvox", "volvox_del"] while its adapter
// declares queryAssembly volvox_del / targetAssembly volvox, so the level's top
// row is the adapter's TARGET — the swapped-assemblies case the codebase warns
// about elsewhere, and a config someone can legitimately write. The walk then
// clamps the anchor window to a block whose axes are not what the plan thought
// and brings both ends back on ONE coordinate.
//
// Two things made that a loop rather than a bad placement. A view cannot show a
// zero-width span: `navToResolvedSpan` widens it to a base and the view's zoom
// floor widens it to sixteen, so `alreadyShowing` compared a 16bp window
// against a 0bp answer with 1bp of slack, said no, and renavigated — which
// flushed the row's coarse blocks and woke the pass that had just run.
test('a swapped-assembly track holds the row rather than spinning', async () => {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
      tracks: ['volvox_del.paf'],
    },
  }) as unknown as SyntenyView
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, timeout)
  const display = view.levels[0]!.linearSyntenyDisplays[0]!
  await waitFor(() => {
    expect(display.featureData).toBeDefined()
  }, timeout)

  const [top, bottom] = view.views
  const before = windowOf(bottom!)
  const call = jest.spyOn(getSession(top!).rpcManager, 'call')

  view.setRowSyncMode('follow')
  view.setFollowAnchorIndex(0)
  await top!.navToLocString('ctgA:30000..31000', 'volvox')
  // long enough that a runaway would have issued hundreds by now; before the
  // fix this never returned at all
  await new Promise(resolve => setTimeout(resolve, 6000))

  expect(
    call.mock.calls.filter(c => c[1] === 'SyntenyResolveMatchingRegion').length,
  ).toBeLessThan(5)
  // held, rather than flung to the sixteen bases around a coordinate the
  // arithmetic never identified
  expect(windowOf(bottom!)).toEqual(before)
  // and it says so, since a held row and a dead follow look identical
  expect(view.followUnaligned).toBe(true)
}, 60000)

// The backstop, against the pathology itself rather than against either cause
// of it.
//
// `navToLocString` replaces the row's `displayedRegions` whether or not it
// moves the row, and that invalidates `followPairs`, which is the first thing
// the exact pass reads — so the pass wakes on its own navigation with nothing
// else about the row having changed. Measured on the swapped track: coarse
// blocks, featureData and width all stable across fourteen consecutive passes.
// Nothing damps that, so an `alreadyShowing` that says no while the row has
// stopped moving is a locked tab rather than a misplacement, and the two
// arithmetic fixes above close the two ways that is currently reachable rather
// than the shape of it.
//
// A navigation that churns state without moving the row is that shape exactly,
// and repeating it is the one thing the follow can recognise unaided: the same
// target asked for from the same place twice.
//
// The COUNT is the assertion, not where the row ends up — with navigation
// blocked the frame pass still places it, which is worth knowing and is why
// this cannot assert a stalled follow.
test('a navigation that does not move the row is not asked for twice', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  let navs = 0
  jest.spyOn(target!, 'navToLocString').mockImplementation(async () => {
    navs++
    // the churn without the movement: enough to invalidate followPairs and
    // wake the pass, which is what made this unbounded
    target!.setDisplayedRegions([...target!.displayedRegions])
    // a runaway spins here forever, and jest's own timeout does not fire
    // because the loop starves the timer queue — so this has to break itself,
    // and then FAIL on the count rather than hang
    if (navs > 20) {
      view.setRowSyncMode('independent')
    }
    return
  })

  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await new Promise(resolve => setTimeout(resolve, 4000))

  expect(navs).toBeLessThanOrEqual(2)
}, 60000)

test('the two row-sync modes are mutually exclusive', async () => {
  const view = await openSyntenyView()
  const model = view as unknown as {
    linkViews: boolean
    followSynteny: boolean
  }

  view.setRowSyncMode('link')
  expect([model.linkViews, model.followSynteny]).toEqual([true, false])

  view.setRowSyncMode('follow')
  expect([model.linkViews, model.followSynteny]).toEqual([false, true])

  view.setRowSyncMode('independent')
  expect([model.linkViews, model.followSynteny]).toEqual([false, false])
})

// The exclusion belongs to the two properties, and `setRowSyncMode` was the
// only thing applying it — so a session naming both arrived with neither half
// applied and nothing downstream resolved it. The header reads `follow` while
// the pixel lock is still installed underneath, which is the pair fighting.
test('a session naming both row-sync modes loads with only the follow on', () => {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    linkViews: true,
    followSynteny: true,
    init: {
      views: [{ assembly: QUERY_ASM }, { assembly: TARGET_ASM }],
      tracks: ['volvox_inv_indels'],
    },
  }) as unknown as { linkViews: boolean; followSynteny: boolean }

  expect([view.linkViews, view.followSynteny]).toEqual([false, true])
})

test('setLinkViews drops the follow rather than running beside it', async () => {
  const view = await openSyntenyView()
  const model = view as unknown as {
    linkViews: boolean
    followSynteny: boolean
    setLinkViews: (arg: boolean) => void
  }
  view.setRowSyncMode('follow')

  model.setLinkViews(true)

  expect([model.linkViews, model.followSynteny]).toEqual([true, false])
})
