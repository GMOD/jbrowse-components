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
