import { getSession } from '@jbrowse/core/util'
import { waitFor } from '@testing-library/react'

import { followSettled } from './syntenyFollowSettle.ts'
import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = { timeout: 30000 }
const ASM = 'volvox'

// Clicking an off-screen mate mark navigates a row, and the follow's whole job
// is to navigate rows — so the two meet, and until this they met badly. A row
// the follow MOVES is re-asserted onto the anchor's mapping every time the
// anchor settles (`installSyntenyFollow`'s exact pass exists to re-assert over
// a row the user dragged), so the click ran, posted its snackbar, and the row
// came straight back to where the follow wanted it. Nothing said so.
//
// It needs the real thing: a PAF, a worker fetch and both of the follow's
// clocks. `offscreenMateNav.integration.test.ts` is the model-level half and
// cannot see this, because with no alignments there is nothing for a follow to
// re-assert.

interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  followAnchorIndex: number
  levels: {
    level: number
    linearSyntenyDisplays: { featureData?: unknown }[]
    showOffscreenMateContig: (
      refName: string,
      row: number,
      mate?: {
        locus: { start: number; end: number }
        mateCumBp?: { start: number; end: number }
      },
    ) => void
  }[]
  setWidth: (n: number) => void
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
  setFollowAnchorIndex: (idx: number) => void
}

// volvox_contig_swap.paf, volvox against itself: ctgA's first 6079 bases align
// to ctgB and ctgB's to ctgA. The SWAP is what makes this measurable — with a
// 1:1 self-alignment the follow's answer for a row is the contig it is already
// on, so a row that snapped back would look exactly like a row that stayed.
async function openSwapView() {
  const { session } = await getTestSession()
  const added = session.addTrackConf({
    type: 'SyntenyTrack',
    trackId: 'volvox_contig_swap',
    name: 'volvox_contig_swap',
    assemblyNames: [ASM, ASM],
    adapter: {
      type: 'PAFAdapter',
      uri: 'volvox_contig_swap.paf',
      assemblyNames: [ASM, ASM],
    },
  }) as { trackId: string }
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: ASM }, { assembly: ASM }],
    tracks: [added.trackId],
  })) as unknown as SyntenyView
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, timeout)
  await waitFor(() => {
    expect(view.levels[0]!.linearSyntenyDisplays[0]!.featureData).toBeDefined()
  }, timeout)
  return view
}

function regionsOf(lgv: LinearGenomeViewModel) {
  return lgv.displayedRegions.map(r => r.refName)
}

// Row 0 on ctgB, so the follow's answer for row 1 is ctgA — and the mark we
// then click names ctgB, which is a contig the follow would never send it to.
async function followingSwap() {
  const view = await openSwapView()
  const [row0, row1] = view.views
  await row0!.navToLocString('ctgB', ASM)
  await row1!.navToLocString('ctgA', ASM)
  view.setRowSyncMode('follow')
  await followSettled(view.views)
  expect(regionsOf(row1!)).toEqual(['ctgA'])
  return { view, row0: row0!, row1: row1! }
}

test('a mark on a followed row shows its contig, and is not undone by the follow', async () => {
  const { view, row1 } = await followingSwap()

  view.levels[0]!.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 0, end: 6079 },
  })
  await waitFor(() => {
    expect(regionsOf(row1)).toEqual(['ctgA', 'ctgB'])
  }, timeout)
  await followSettled(view.views)

  expect(regionsOf(row1)).toEqual(['ctgA', 'ctgB'])
  // ...because the click took the anchor. Left as a followed row this read
  // ['ctgA'] — the navigation ran and the follow put it straight back.
  expect(view.followAnchorIndex).toBe(1)
}, 60000)

// The anchor is a persisted view-wide setting, so taking it is a real change to
// undo and not an implementation detail of the navigation.
test('...and the undo puts the anchor back with the regions', async () => {
  const { view, row1 } = await followingSwap()
  const session = getSession(row1) as unknown as {
    snackbarMessages: { message: string; actions?: { onClick: () => void }[] }[]
  }

  view.levels[0]!.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 0, end: 6079 },
  })
  await waitFor(() => {
    expect(session.snackbarMessages.length).toBeGreaterThan(0)
  }, timeout)

  const [message] = session.snackbarMessages
  expect(message!.message).toContain('following this row')
  message!.actions![0]!.onClick()

  expect(view.followAnchorIndex).toBe(0)
  expect(regionsOf(row1)).toEqual(['ctgA'])
}, 60000)

// The anchor row itself is not a row the follow moves, so nothing there needs
// taking — and taking it anyway would report a change the click did not make.
test('a mark on the anchor row leaves the anchor alone', async () => {
  const { view, row0 } = await followingSwap()
  const session = getSession(row0) as unknown as {
    snackbarMessages: { message: string }[]
  }

  view.levels[0]!.showOffscreenMateContig('ctgA', 0, {
    locus: { start: 0, end: 6079 },
  })
  await waitFor(() => {
    expect(session.snackbarMessages.length).toBeGreaterThan(0)
  }, timeout)

  expect(view.followAnchorIndex).toBe(0)
  expect(session.snackbarMessages[0]!.message).not.toContain('following')
}, 60000)
