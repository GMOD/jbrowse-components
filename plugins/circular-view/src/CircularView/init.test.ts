import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addVolvoxConf(session: ReturnType<typeof createTestSession>) {
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: ['ctgA', 'ctgB'].map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        })),
      },
    },
  })
}

async function setup(init: Record<string, unknown>) {
  const session = createTestSession()
  addVolvoxConf(session)
  const view = (await session.launchView(
    'CircularView',
    init,
  )) as CircularViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.displayedRegions.length > 0)
  return { session, view }
}

test('displayedRegionNames restricts the circle, in the order given', async () => {
  const { view } = await setup({
    assembly: 'volvox',
    displayedRegionNames: ['ctgB'],
  })
  expect(view.displayedRegions.map(r => r.refName)).toEqual(['ctgB'])
})

// selectNamedRegions drops names that match nothing, so a typo used to hand
// setDisplayedRegions an empty list — which drops the view to its import form,
// with `init` already consumed and nothing left to rebuild the figure from
test('a displayedRegionNames that matches nothing keeps the whole assembly', async () => {
  const { session, view } = await setup({
    assembly: 'volvox',
    displayedRegionNames: ['chrTypo'],
  })
  expect(view.displayedRegions.map(r => r.refName)).toEqual(['ctgA', 'ctgB'])
  expect(view.showImportForm).toBe(false)
  expect(
    session.snackbarMessages.map((m: { message: string }) => m.message),
  ).toEqual([expect.stringMatching(/matched no regions/)])
})

// init is transient once the figure exists: postProcessSnapshot strips it, so
// the drain has to have consumed it by the time regions are on the circle
test('a consumed init is cleared rather than re-applied on the next resize', async () => {
  const { view } = await setup({ assembly: 'volvox' })
  await when(() => view.pendingLaunch === undefined)

  view.zoomInButton()
  const { bpPerPx } = view
  view.setWidth(600)
  expect(view.bpPerPx).toBe(bpPerPx)
})
