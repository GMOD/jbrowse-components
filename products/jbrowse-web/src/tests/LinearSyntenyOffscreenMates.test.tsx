import { waitFor } from '@testing-library/react'

import {
  offscreenMateCount,
  offscreenMateStrips,
} from '../../../../plugins/linear-comparative-view/src/LinearSyntenyViewHelper/offscreenMateStrip.ts'
import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type { OffscreenMateSource } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyViewHelper/offscreenMateStrip.ts'
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
  showOffscreenMates: boolean
  setWidth: (n: number) => void
  setShowOffscreenMates: (flag: boolean) => void
}

// The two surfaces the band itself reads — what gets a strip, and what a mark's
// tooltip prints. Asserted through these rather than through a model getter of
// their own, so a change that stops the marks appearing fails here.
function level(view: SyntenyView) {
  return view.levels[0] as unknown as OffscreenMateSource
}

function strips(view: SyntenyView) {
  return offscreenMateStrips(level(view))
}

function count(view: SyntenyView, refName: string) {
  return offscreenMateCount(level(view), refName, 'top')
}

async function openSyntenyView() {
  const { session } = await getTestSession()
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
    tracks: ['volvox_fake_synteny'],
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
// mounts no strip at all, whatever the setting says, so the default only
// changes the views that WERE hiding something.
test('both rows showing every contig hides nothing', async () => {
  const view = await openSyntenyView()
  expect(view.showOffscreenMates).toBe(true)
  expect(strips(view)).toEqual([])
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
    expect(strips(view).length).toBe(1)
  }, timeout)
  expect(strips(view)[0]!.side).toBe('top')
  expect(count(view, 'ctgB')).toBeGreaterThan(0)
})

// ON BY DEFAULT, which is the whole decision: a locus syntenic to a contig the
// facing row is not showing looked exactly like a locus syntenic to nothing,
// and a reader who never opened the settings menu never learned otherwise.
test('and marks them by default', async () => {
  const view = await openSyntenyView()
  const [, target] = view.views
  await target!.navToLocString('ctgA')
  await waitFor(() => {
    expect(strips(view).length).toBe(1)
  }, timeout)

  expect(view.showOffscreenMates).toBe(true)
})

// THE OTHER HALF, and the one stacked whole assemblies are made of. Both rows
// display every contig, so the worker's own lane is empty by construction — and
// `overdrawPx` still culls every ribbon whose mate has scrolled out of the band,
// which is most of them the moment the rows are not over each other. The band
// drew almost nothing and said nothing about it. Both edges get a strip: the
// lower row is queried too, and the alignments anchored down there have their
// mates off the upper row's band just the same.
test('a row scrolled off its mate marks what it can no longer pair', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  expect(strips(view)).toEqual([])

  query!.zoomTo(10)
  query!.scrollTo(0)
  // onto volvox's other contig, so ctgA's mate is off this row's overdraw band
  // while both rows still display both contigs
  target!.zoomTo(1)
  target!.scrollTo(52000)

  await waitFor(() => {
    expect(strips(view).map(s => s.side)).toEqual(['top', 'bottom'])
  }, timeout)
})

// ...and it goes away again on its own, because it is a question about where
// that row is rather than about what was fetched. A mark decided when the data
// landed would sit beside the ribbon it says does not exist. The bottom strip
// stays: the upper row is still zoomed onto one stretch of ctgA, so the ctgB
// alignments anchored below it still have nowhere to land.
test('and stops marking it when that row comes back', async () => {
  const view = await openSyntenyView()
  const [query, target] = view.views
  query!.zoomTo(10)
  query!.scrollTo(0)
  target!.zoomTo(1)
  target!.scrollTo(52000)
  await waitFor(() => {
    expect(strips(view).length).toBe(2)
  }, timeout)

  target!.showAllRegions()
  await waitFor(() => {
    expect(strips(view).map(s => s.side)).toEqual(['bottom'])
  }, timeout)
})
