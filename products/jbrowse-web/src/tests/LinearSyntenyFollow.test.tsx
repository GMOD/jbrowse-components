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

// interpolateFollowSpan asks whoever calls it to tell the user the answer is an
// approximation, and for a long time nobody did: the envelope and the CIGAR
// walk place a row identically as far as the screen is concerned, so a view
// zoomed out past one alignment reports itself as following exactly.
test('the view says when a placement was proportional rather than walked', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  view.setRowSyncMode('follow')

  // inside one alignment, and this file's rows all carry CIGARs, so the walk is
  // available and taken
  await query!.navToLocString('ctgA:30000..31000', QUERY_ASM)
  await waitFor(() => {
    expect(windowOf(target!).start).toBeGreaterThan(29500)
  }, timeout)
  expect(view.followApproximate).toBe(false)

  // wider than any one alignment: the answer is now the envelope, which
  // interpolates each window edge through the block it lands in
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
