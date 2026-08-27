import { createTestSession } from '@jbrowse/web/testUtils'
import { observable, runInAction, when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Big enough that a screen is a slice of it: `staticBlocks` is a coarse,
// quantized set, so on a contig a screen can hold whole it never changes and
// there is nothing for a pan to invalidate.
const CTG_LEN = 10_000_000

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'volvox-ctgA',
          start: 0,
          end: CTG_LEN,
          seq: 'a'.repeat(1000),
        },
      ],
    },
  },
}

const trackConf = {
  trackId: 'tk1',
  type: 'VariantTrack',
  name: 'tk1',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      { uniqueId: 'f1', refName: 'ctgA', start: 100, end: 200, name: 'f1' },
    ],
  },
}

function blockDesc(view: { staticBlocks: { contentBlocks: unknown[] } }) {
  return (view.staticBlocks.contentBlocks as { start: number; end: number }[])
    .map(b => `${b.start}-${b.end}`)
    .join(',')
}

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  session.addTrackConf(trackConf)

  // Observable, so `when` below can actually wait on it — a plain array never
  // wakes the reaction and every wait times out looking like a missing fetch.
  const fetched = observable.array<string>([], { deep: false })
  const rpc = session.rpcManager
  const call = rpc.call.bind(rpc)
  rpc.call = ((
    sessionId: string,
    method: string,
    args: { regions?: { start: number; end: number }[] },
  ) => {
    if (method === 'BreakpointGetFeatures') {
      const desc = (args.regions ?? [])
        .map(r => `${r.start}-${r.end}`)
        .join(',')
      runInAction(() => {
        fetched.push(desc)
      })
    }
    return call(sessionId, method as never, args as never)
  }) as typeof rpc.call

  const view = session.addView('BreakpointSplitView', {
    init: [
      { assembly: 'volvox', loc: 'ctgA:1-10000' },
      { assembly: 'volvox', loc: 'ctgA:1-10000' },
    ],
  }) as BreakpointViewModel
  view.setWidth(800)
  await when(() => view.initialized, { timeout: 20000 })
  for (const v of view.views) {
    v.showTrack('tk1')
  }
  // Both rows blocked out AND fetched at those blocks, which is the state both
  // tests start from. Waiting on `fetched.length > 0` instead catches the first
  // overlay fetch, and that one rides the leading edge the moment a track
  // matches across the rows — before either row has blocks, with an empty
  // region list, which is still a call.
  await when(
    () =>
      view.views.every(
        v => blockDesc(v) !== '' && fetched.includes(blockDesc(v)),
      ),
    { timeout: 20000 },
  )
  return { view, fetched }
}

// The overlay fetch is an autorun, and the blocks it fetches over are the only
// thing in its dependency set that a pan moves. Nothing pinned that: the read
// used to sit inside `getBlockFeatures`, two files away, tracked only because
// the caller's `tracks.map` runs its async bodies as far as their first await
// synchronously. One hoisted await along that chain and every overlay would
// have frozen at the blocks it first drew, with no test failing and the arcs
// still on screen — drawn against features from wherever the view used to be.
//
// A pan of 5000px at ~12.5 bp/px, which is what it takes: `staticBlocks` is
// quantized, so a pan inside the current set is deliberately not a refetch.
test('panning onto new blocks refetches the overlay against them', async () => {
  const { view, fetched } = await setup()
  const before = fetched.length
  const panned = view.views[0]!

  expect(blockDesc(panned)).toBe('0-10000,10000-20000')
  panned.scrollTo(panned.offsetPx + 5000)
  const after = blockDesc(panned)
  expect(after).not.toBe('0-10000,10000-20000')

  await when(() => fetched.length > before, { timeout: 20000 })

  // the NEW blocks, not merely another call: a refetch that reran on some other
  // dependency and re-sent the old regions is the failure this is about
  expect(fetched.slice(before)).toContain(after)
}, 60000)

// The other row is unmoved, so its features are still the right ones — but it
// is refetched too, because one `Promise.all` covers both rows and the result
// replaces the whole map. Asserted so that a future split into per-row fetches
// is a deliberate change rather than a silent one.
test('the unmoved row is refetched at its own unchanged blocks', async () => {
  const { view, fetched } = await setup()
  const before = fetched.length
  const still = blockDesc(view.views[1]!)

  view.views[0]!.scrollTo(view.views[0]!.offsetPx + 5000)
  await when(() => fetched.length > before, { timeout: 20000 })

  expect(blockDesc(view.views[1]!)).toBe(still)
  expect(fetched.slice(before)).toContain(still)
}, 60000)
