import { waitFor } from '@testing-library/react'

import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = { timeout: 30000 }

// volvox_fake_synteny.paf pairs ctgA with ctgA and ctgB with ctgB, so a target
// row showing both contigs drops nothing and a target row narrowed to one drops
// the other contig's alignments — which is exactly the class this reports.
interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  levels: { linearSyntenyDisplays: { featureData?: unknown }[] }[]
  offscreenMateTally: { refName: string; count: number }[]
  showOffscreenMates: boolean
  bidirectionalFetch: boolean
  offscreenMateMode: 'off' | 'query' | 'both'
  setWidth: (n: number) => void
  setShowOffscreenMates: (arg: boolean) => void
  setOffscreenMateMode: (mode: 'off' | 'query' | 'both') => void
}

async function openSyntenyView() {
  const { session } = await getTestSession()
  const view = (await session.launchView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
      tracks: ['volvox_fake_synteny'],
    },
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

// The half that makes marking-by-default cheap: a view with nothing hidden
// claims nothing, whatever the setting says, so the default only changes the
// views that WERE hiding something. What it draws in that state — nothing, for
// want of a strip — is `offscreenMateStrip.test.ts`'s.
test('both rows showing every contig hides nothing', async () => {
  const view = await openSyntenyView()
  expect(view.showOffscreenMates).toBe(true)
  expect(view.offscreenMateTally).toEqual([])
})

// The complaint the feature answers: a locus syntenic to a contig you did not
// stack looks exactly like a locus syntenic to nothing.
test('a row narrowed to one contig reports what it can no longer pair', async () => {
  const view = await openSyntenyView()
  const [, target] = view.views
  // replaces displayedRegions with the one region, so ctgB has no home on this
  // row and every ctgB alignment loses its second endpoint
  await target!.navToLocString('ctgA')

  await waitFor(() => {
    expect(view.offscreenMateTally.length).toBeGreaterThan(0)
  }, timeout)
  expect(view.offscreenMateTally.map(e => e.refName)).toEqual(['ctgB'])
  expect(view.offscreenMateTally[0]!.count).toBeGreaterThan(0)
})

// ON BY DEFAULT, which is the whole decision: a locus syntenic to a contig the
// facing row is not showing looked exactly like a locus syntenic to nothing,
// and a reader who never opened the settings menu never learned otherwise.
test('and marks them by default', async () => {
  const view = await openSyntenyView()
  const [, target] = view.views
  await target!.navToLocString('ctgA')
  await waitFor(() => {
    expect(view.offscreenMateTally.length).toBeGreaterThan(0)
  }, timeout)

  expect(view.offscreenMateMode).toBe('query')
})

// The step that costs a QUERY stays opt-in, and it is the same control: the
// three modes are one question about how hard to look, and only the last one
// goes back to the adapter.
test('searching the other row is a step further in, not the default', async () => {
  const view = await openSyntenyView()
  expect(view.bidirectionalFetch).toBe(false)

  view.setOffscreenMateMode('both')
  expect(view.showOffscreenMates).toBe(true)
  expect(view.bidirectionalFetch).toBe(true)

  view.setOffscreenMateMode('off')
  expect(view.showOffscreenMates).toBe(false)
  expect(view.bidirectionalFetch).toBe(false)
})
