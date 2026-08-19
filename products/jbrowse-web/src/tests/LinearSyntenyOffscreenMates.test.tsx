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
  setWidth: (n: number) => void
  setShowOffscreenMates: (arg: boolean) => void
  headerMenuItems: () => { label?: string }[]
}

async function openSyntenyView() {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
      tracks: ['volvox_fake_synteny'],
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

test('both rows showing every contig hides nothing, and says nothing', async () => {
  const view = await openSyntenyView()
  expect(view.offscreenMateTally).toEqual([])
  expect(view.headerMenuItems().some(i => i.label?.includes('not shown'))).toBe(
    false,
  )
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

test('and offers to draw them, naming the number in the label', async () => {
  const view = await openSyntenyView()
  const [, target] = view.views
  await target!.navToLocString('ctgA')
  await waitFor(() => {
    expect(view.offscreenMateTally.length).toBeGreaterThan(0)
  }, timeout)

  const count = view.offscreenMateTally[0]!.count
  const item = view.headerMenuItems().find(i => i.label?.includes('not shown'))
  expect(item?.label).toBe(
    `${count.toLocaleString()} alignments map to 1 contig not shown`,
  )
  expect(view.showOffscreenMates).toBe(false)
})
