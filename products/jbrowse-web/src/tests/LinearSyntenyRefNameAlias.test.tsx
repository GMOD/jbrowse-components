import { waitFor } from '@testing-library/react'

import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = { timeout: 30000 }
// the known-failing case below only has to prove the row does NOT move, so it
// waits long enough to cover the coarse-blocks debounce and no longer
const shortTimeout = { timeout: 4000 }

// THE SAME ALIGNMENT, SPELLED TWO WAYS. Both files are one 50001-vs-45141 block
// (28498M 4860I 16643M) between volvox and volvox_del, differing only in the
// query column: the control says `ctgA`, the other says `A`, which
// `test_data/volvox/config.json` declares as a refName alias of `ctgA` on the
// volvox assembly.
//
// Both LOAD AND DRAW — the fetch renames the view's regions into the adapter's
// namespace on the way in, which is precisely what makes the aliased one work.
// What comes back carries the file's spelling, and every main-thread reader
// compares it against view state, which is canonical.
//
// The alias is on the QUERY axis on purpose: that is the axis the anchor row's
// window is matched against in `pickFollowFeature`, so it is the one that
// decides whether the follow finds anything at all.
const CONTROL = 'volvox_alias_control.paf'
const ALIASED = 'volvox_alias_query.paf'

// In the first 28498M block the two assemblies run 1:1, so the expected answer
// needs no arithmetic and a row left where it started fails loudly.
const LOCUS = 'ctgA:10000..11000'

interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  levels: { linearSyntenyDisplays: { featureData?: unknown }[] }[]
  followUnaligned: boolean
  setWidth: (n: number) => void
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
}

async function openWith(trackId: string) {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
      tracks: [trackId],
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

function windowOf(lgv: LinearGenomeViewModel) {
  const blocks = lgv.dynamicBlocks.contentBlocks
  return {
    refName: blocks[0]?.refName,
    start: Math.min(...blocks.map(b => b.start)),
    end: Math.max(...blocks.map(b => b.end)),
  }
}

// The premise of the file: an aliased file is not a broken file. If this fails,
// the fixture is wrong rather than the follow.
test('both files load, so the alias resolves for the fetch', async () => {
  for (const trackId of [CONTROL, ALIASED]) {
    const view = await openWith(trackId)
    expect(view.levels[0]!.linearSyntenyDisplays[0]!.featureData).toBeDefined()
  }
})

test('the follow places the row through a canonically-spelled file', async () => {
  const view = await openWith(CONTROL)
  const [volvox, del] = view.views
  view.setRowSyncMode('follow')
  await volvox!.navToLocString(LOCUS, 'volvox')

  await waitFor(() => {
    const win = windowOf(del!)
    expect(win.refName).toBe('ctgA')
    expect(win.start).toBeGreaterThan(9500)
    expect(win.end).toBeLessThan(11500)
  }, timeout)
})

// The bug, and `test.failing` rather than a skip so that fixing it breaks this
// line instead of leaving a dead test behind. Same alignment, same navigation,
// only the file's spelling of the anchor row's contig differs — and
// `pickFollowFeature` compares that spelling against a window read off
// `dynamicBlocks`, which is canonical. Nothing matches, so the follow reports
// the window as unaligned and every row holds, which is indistinguishable from
// a window with genuinely nothing under it.
//
// Two channels carry the adapter's spelling to the main thread and BOTH have to
// be canonicalized for this to pass: `featureData.refNames`/`mateRefNames` from
// the fetch, and `ResolvedSpan.refName` from `SyntenyResolveMatchingRegion`,
// which `alreadyShowing`, `followTransform` and `positionViewOnSpan` all then
// compare against view state. `getAdapterToCanonicalRefNameMap`
// (@jbrowse/synteny-core) is the map for both.
test.failing(
  'the follow places the row through an alias-spelled file too',
  async () => {
    const view = await openWith(ALIASED)
    const [volvox, del] = view.views
    view.setRowSyncMode('follow')
    await volvox!.navToLocString(LOCUS, 'volvox')

    await waitFor(() => {
      const win = windowOf(del!)
      expect(win.refName).toBe('ctgA')
      expect(win.start).toBeGreaterThan(9500)
      expect(win.end).toBeLessThan(11500)
    }, shortTimeout)
    expect(view.followUnaligned).toBe(false)
  },
)
