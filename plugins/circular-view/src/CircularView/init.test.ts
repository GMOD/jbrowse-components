import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addAssemblyConf(
  session: ReturnType<typeof createTestSession>,
  name: string,
  refNames: string[],
) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: refNames.map(refName => ({
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

async function setup(init: Record<string, unknown>, assemblies = ['volvox']) {
  const session = createTestSession()
  for (const name of assemblies) {
    addAssemblyConf(session, name, ['ctgA', 'ctgB'])
  }
  const view = (await session.launchView(
    'CircularView',
    init,
  )) as CircularViewModel
  view.setWidth(800)
  for (const name of assemblies) {
    await session.assemblyManager.waitForAssembly(name)
  }
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

// The circle a synteny ribbon plot is drawn on: one genome's contigs, then the
// other's, in the order the launch named them. The view derives its
// `assemblyNames` from the regions, so nothing else has to be told.
test('two assemblies each contribute their slices, in the order named', async () => {
  const { view } = await setup({ assembly: ['volvox', 'volvox2'] }, [
    'volvox',
    'volvox2',
  ])
  expect(
    view.displayedRegions.map(r => `${r.assemblyName}:${r.refName}`),
  ).toEqual(['volvox:ctgA', 'volvox:ctgB', 'volvox2:ctgA', 'volvox2:ctgB'])
  expect(view.assemblyNames).toEqual(['volvox', 'volvox2'])
})

test('displayedRegionNames restricts each assembly it names', async () => {
  const { view } = await setup(
    { assembly: ['volvox', 'volvox2'], displayedRegionNames: ['ctgB'] },
    ['volvox', 'volvox2'],
  )
  expect(
    view.displayedRegions.map(r => `${r.assemblyName}:${r.refName}`),
  ).toEqual(['volvox:ctgB', 'volvox2:ctgB'])
})
