import { waitFor } from '@testing-library/react'

import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = { timeout: 30000 }
const ASM = 'volvox'
const MATE = 'volvox_random_inv'

// The unit harness hands the follow a strand by fixture. This is the strand as
// the PAF adapter packs it, through the worker, both of the follow's clocks and
// the real `horizontallyFlip` — which replaces `displayedRegions` and so wakes
// the exact pass. A flip that did not converge would spin here, not there.

interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  levels: { linearSyntenyDisplays: { featureData?: unknown }[] }[]
  setWidth: (n: number) => void
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
  setFollowMatchOrientation: (arg: boolean) => void
}

// volvox_inv_indels.paf, volvox_random_inv against volvox: forward except two
// short reverse-strand blocks, one over volvox ctgA 18559-19001 flanked by
// forward blocks on both sides — so a window inside it and a window just past
// it are both rung 1, on blocks of opposite strand. Coordinates are the target
// (volvox) axis, which is the anchor row here.
const INVERTED = { start: 18600, end: 18950 }
const FORWARD = { start: 20000, end: 25000 }

async function openView() {
  const { session } = getTestSession()
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: ASM }, { assembly: MATE }],
      tracks: ['volvox_inv_indels'],
    },
  }) as unknown as SyntenyView
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, timeout)
  await waitFor(() => {
    expect(view.levels[0]!.linearSyntenyDisplays[0]!.featureData).toBeDefined()
  }, timeout)
  return view
}

const reversedOf = (lgv: LinearGenomeViewModel) =>
  !!lgv.dynamicBlocks.contentBlocks[0]?.reversed

// Where the row ends up when the follow has placed it: inside the inverted
// block, which is a window it has to be moved onto from the whole of ctgA.
const placedInsideInverted = (lgv: LinearGenomeViewModel) => {
  const [block] = lgv.dynamicBlocks.contentBlocks
  expect(block!.start).toBeGreaterThan(18000)
  expect(block!.end).toBeLessThan(19500)
}

test('a followed row turns round inside an inverted alignment and back past it', async () => {
  const view = await openView()
  const [row0, row1] = view.views
  await row0!.navToLocString(`ctgA:${INVERTED.start}-${INVERTED.end}`, ASM)
  await row1!.navToLocString('ctgA', MATE)
  view.setRowSyncMode('follow')
  view.setFollowMatchOrientation(true)
  await waitFor(() => {
    expect(reversedOf(row1!)).toBe(true)
  }, timeout)
  expect(reversedOf(row0!)).toBe(false)

  await row0!.navToLocString(`ctgA:${FORWARD.start}-${FORWARD.end}`, ASM)
  await waitFor(() => {
    expect(reversedOf(row1!)).toBe(false)
  }, timeout)
}, 60000)

// The checkbox is live, and the rows are usually already following when it is
// ticked. `orient` runs past the exact pass's first `await` and inside its
// `untracked`, so the flag has to be read in `planLevel` to wake anything.
test('ticking it after the rows have settled turns the row round', async () => {
  const view = await openView()
  const [row0, row1] = view.views
  await row0!.navToLocString(`ctgA:${INVERTED.start}-${INVERTED.end}`, ASM)
  await row1!.navToLocString('ctgA', MATE)
  view.setRowSyncMode('follow')
  await waitFor(() => {
    placedInsideInverted(row1!)
  }, timeout)
  expect(reversedOf(row1!)).toBe(false)

  view.setFollowMatchOrientation(true)
  await waitFor(() => {
    expect(reversedOf(row1!)).toBe(true)
  }, timeout)
}, 60000)

test('off, the row is placed inside the inverted alignment without turning', async () => {
  const view = await openView()
  const [row0, row1] = view.views
  await row0!.navToLocString(`ctgA:${INVERTED.start}-${INVERTED.end}`, ASM)
  await row1!.navToLocString('ctgA', MATE)
  view.setRowSyncMode('follow')
  await waitFor(() => {
    placedInsideInverted(row1!)
  }, timeout)
  expect(reversedOf(row1!)).toBe(false)
}, 60000)
