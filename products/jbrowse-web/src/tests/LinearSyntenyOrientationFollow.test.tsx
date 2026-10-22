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

interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  levels: { linearSyntenyDisplays: { featureData?: unknown }[] }[]
  setWidth: (n: number) => void
  setFollowSynteny: (flag: boolean) => void
}

// volvox_inv_indels.paf, volvox_random_inv against volvox: forward except two
// short reverse-strand blocks, one over volvox ctgA 18559-19001 flanked by
// forward blocks on both sides. Coordinates are the target (volvox) axis,
// which is the anchor row here.
const INVERTED = { start: 18600, end: 18950 }

async function openView() {
  const { session } = await getTestSession()
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: ASM }, { assembly: MATE }],
    tracks: ['volvox_inv_indels'],
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

const reversedOf = (lgv: LinearGenomeViewModel) =>
  !!lgv.dynamicBlocks.contentBlocks[0]?.reversed

// Where the row ends up when the follow has placed it: inside the inverted
// block, which is a window it has to be moved onto from the whole of ctgA.
const placedInsideInverted = (lgv: LinearGenomeViewModel) => {
  const [block] = lgv.dynamicBlocks.contentBlocks
  expect(block!.start).toBeGreaterThan(18000)
  expect(block!.end).toBeLessThan(19500)
}

test('a followed row is placed inside an inverted alignment without turning', async () => {
  const view = await openView()
  const [row0, row1] = view.views
  await row0!.navToLocString(`ctgA:${INVERTED.start}-${INVERTED.end}`, ASM)
  await row1!.navToLocString('ctgA', MATE)
  view.setFollowSynteny(true)
  await waitFor(() => {
    placedInsideInverted(row1!)
  }, timeout)
  expect(reversedOf(row1!)).toBe(false)
}, 60000)
