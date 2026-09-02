import { waitFor } from '@testing-library/react'

import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = { timeout: 30000 }

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

// The MATE axis's copy of the same problem, which needs the stack the other way
// up: volvox is the only assembly here that declares aliases, so it has to be
// the axis that is NOT queried for its spelling to reach `mateRefNameDict`.
// One transposed row, no `cg:Z:` — see the test at the bottom for why the
// missing CIGAR is the point rather than an omission.
const ALIASED_TARGET = 'volvox_alias_target.paf'

// THE SAME TWO NAMESPACES AGAIN, on the pair of lanes that name contigs neither
// row is displaying. Three rows: one ordinary ribbon, one anchored on volvox_del
// ctgA whose volvox mate is `B`, and one anchored on volvox ctgA whose
// volvox_del mate is `B`. Narrow both rows to ctgA and the last two are what an
// off-screen mate IS — an alignment with no second endpoint to run a ribbon to.
//
// `B` on BOTH sides on purpose. It is an alias of ctgB on volvox and nothing at
// all on volvox_del, so one string tells the two resolvers apart: whichever lane
// is resolved against the wrong assembly gets the other's answer.
const OFFSCREEN_ALIAS = 'volvox_offscreen_alias.paf'

// A THIRD namespace, not a third refName: this track's every refName is
// canonical and only its second ASSEMBLY name is an alias (`vvx` for volvox,
// which `test_data/volvox/config.json` already declared). It is a separate file
// so the two cannot be confused for each other.
const ALIASED_ASSEMBLY = 'volvox_asmalias.paf'

// In the first 28498M block the two assemblies run 1:1, so the expected answer
// needs no arithmetic and a row left where it started fails loudly.
const LOCUS = 'ctgA:10000..11000'

interface SyntenyDisplay {
  featureData?: {
    refNameDict: string[]
    mateRefNameDict: string[]
    mateAssemblyNameDict: string[]
    offscreenMates: { mateRefNameDict: string[] }
    targetOffscreenMates: { mateRefNameDict: string[] }
  }
}

interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  levels: { linearSyntenyDisplays: SyntenyDisplay[] }[]
  followUnaligned: boolean
  setWidth: (n: number) => void
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
  setBidirectionalFetch: (arg: boolean) => void
}

async function openWith(
  trackId: string,
  assemblies = ['volvox', 'volvox_del'],
) {
  const { session } = await getTestSession()
  const view = (await session.launchView('LinearSyntenyView', {
    views: assemblies.map(assembly => ({ assembly })),
    tracks: [trackId],
  })) as unknown as SyntenyView
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

// THE CASE THE FIX IS FOR, and the one that regresses if either half of it is
// backed out. Same alignment, same navigation; only the file's spelling of the
// anchor row's contig differs. Before the fix `pickFollowFeature` compared that
// spelling against a window read off `dynamicBlocks`, which is canonical,
// nothing matched, and the follow reported the window unaligned and held every
// row — indistinguishable from a window with genuinely nothing under it.
//
// Two channels carry the adapter's spelling to the main thread and BOTH have to
// be canonicalized for this to pass: `featureData`'s
// `refNameDict`/`mateRefNameDict` from the fetch (the dictionaries the
// per-feature ids index, renamed in `LinearSyntenyDisplay/afterAttach`), and
// `ResolvedSpan.refName` from `SyntenyResolveMatchingRegion` (renamed in
// `resolveMatchingSpan`), which `alreadyShowing`, `followTransform` and
// `positionViewOnSpan` all then compare against view state.
// `getCanonicalRefNameFn` (@jbrowse/synteny-core) is the resolver for both;
// renaming a dictionary means re-interning it, for the reason
// `agent-docs/reference/REFNAME_NAMESPACES.md` gives.
//
// Doing only the first half is worse than doing neither, and it fails LOUDER in
// `LinearSyntenyFollow.test.tsx` than here: `alreadyShowing` then compares
// canonical against adapter-space, never matches, and renavigates on every
// wake, which breaks that file's one-RPC-per-settle count.
test('the follow places the row through an alias-spelled file too', async () => {
  const view = await openWith(ALIASED)
  const [volvox, del] = view.views
  view.setRowSyncMode('follow')
  await volvox!.navToLocString(LOCUS, 'volvox')

  await waitFor(() => {
    const win = windowOf(del!)
    expect(win.refName).toBe('ctgA')
    expect(win.start).toBeGreaterThan(9500)
    expect(win.end).toBeLessThan(11500)
  }, timeout)
  expect(view.followUnaligned).toBe(false)
})

// THE OTHER AXIS, which the two tests above cannot reach and which nothing
// pinned: with the alias on the query side both axes' resolvers can be the same
// one — or the mate rename can be dropped outright — and every assertion still
// passes. Here they have to be told apart. `volvox_del` declares no aliases, so
// resolving the mate dictionary against it (the swap) leaves `A` as `A`.
//
// Asserted on the DICTIONARIES rather than on where a row lands, because the
// mate spelling is nearly invisible from the outside: `navToLocString` resolves
// aliases itself, so an un-renamed span still navigates to the right place. What
// it breaks is quieter — `alreadyShowing` compares `A` against a canonical
// `ctgA` and never matches, so the row renavigates on every settle, and
// `positionViewOnSpan` finds no offset for `A` in `displayedRegions` and the
// per-frame pass silently stops moving the row at all.
//
// The file carries NO CIGAR on purpose. With one, the follow resolves through
// `SyntenyResolveMatchingRegion` and channel 2 canonicalizes the answer whatever
// the dictionary says; without one it interpolates across the block and reads
// `feat.mate.refName` straight out of `mateRefNameDict`, which is the only path
// where this dictionary is the sole source of the name.
test('the target axis is canonicalized against its own assembly', async () => {
  const view = await openWith(ALIASED_TARGET, ['volvox_del', 'volvox'])
  const { featureData } = view.levels[0]!.linearSyntenyDisplays[0]!
  expect(featureData!.refNameDict).toEqual(['ctgA'])
  expect(featureData!.mateRefNameDict).toEqual(['ctgA'])
})

// THE OFF-SCREEN MATE LANES, which name contigs nobody requested — so they are
// the same class as `mateRefNameDict` and were the last of it left in the file's
// spelling. Unrenamed, the strip labels its marks `B`, the hamburger item counts
// `B` and `ctgB` as two contigs, and clicking a mark runs `navToLocString` on a
// name the row's assembly may not know at all.
//
// THE TWO LANES TAKE OPPOSITE RESOLVERS, which is the half a shared one gets
// wrong invisibly on any pair that spells its contigs alike: a query-axis mark
// names a contig of the TARGET assembly, and a target-axis mark names one of the
// QUERY assembly. Here `B` resolves to `ctgB` on volvox and to nothing on
// volvox_del, so a swap moves both assertions at once.
test('the off-screen mate contigs are canonicalized, each against its own row', async () => {
  const view = await openWith(OFFSCREEN_ALIAS, ['volvox_del', 'volvox'])
  const [del, volvox] = view.views
  view.setBidirectionalFetch(true)
  await del!.navToLocString('ctgA', 'volvox_del')
  await volvox!.navToLocString('ctgA', 'volvox')

  const display = view.levels[0]!.linearSyntenyDisplays[0]!
  await waitFor(() => {
    expect(display.featureData!.offscreenMates.mateRefNameDict).toEqual([
      'ctgB',
    ])
  }, timeout)
  expect(display.featureData!.targetOffscreenMates.mateRefNameDict).toEqual([
    'B',
  ])
})

// A DIFFERENT NAMESPACE IN THE SAME PAYLOAD, and the failure is the one this
// whole file is about: nothing is missing, nothing errors, and the follow
// reports the window unaligned.
//
// `mateAssemblyNameDict` carries the adapter's `assemblyNames[]` verbatim, which
// is config text; `pickFollowFeature` and `followWindowMapping` look the view's
// `assemblyNames[0]` up in it, which is canonical because it comes off the
// assembly's regions. A track naming its second assembly `vvx` is still offered
// on a level showing `volvox` — `syntenyTrackRows` resolves it through
// `canonicalAssemblyNames` — so the ribbons draw and only the lookup misses. A
// miss is not a skipped filter: `indexOf` gives -1, no feature carries -1, and
// every candidate is dropped.
//
// The query lane is deliberately not canonicalized alongside it — `feat
// .assemblyName` goes back out as `SyntenyResolveMatchingRegion`'s `regions[]`
// assembly, which the adapter matches against its own `assemblyNames[]`. That is
// also why a track aliasing its FIRST assembly is not this bug: the adapter
// matches nothing, and a track that draws no ribbons at all is the loud failure.
test('an assembly named by alias in the track config still follows', async () => {
  const view = await openWith(ALIASED_ASSEMBLY, ['volvox_del', 'volvox'])
  const [del, volvox] = view.views
  expect(
    view.levels[0]!.linearSyntenyDisplays[0]!.featureData!.mateAssemblyNameDict,
  ).toEqual(['volvox'])

  view.setRowSyncMode('follow')
  await del!.navToLocString(LOCUS, 'volvox_del')

  // no CIGAR on that row, so the window maps proportionally across the block:
  // 45141 bp of volvox_del against 50001 of volvox
  await waitFor(() => {
    const win = windowOf(volvox!)
    expect(win.refName).toBe('ctgA')
    expect(win.start).toBeGreaterThan(10500)
    expect(win.end).toBeLessThan(12500)
  }, timeout)
  expect(view.followUnaligned).toBe(false)
})
