import { waitFor } from '@testing-library/react'

import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

import type { MultiWaySyntenyDisplayModel } from '@jbrowse/plugin-linear-comparative-view'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(volvoxGetFile)

async function openMultiWay(trackId: string) {
  const { rootModel } = await getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    assembly: 'volvox',
    loc: 'ctgA:1-50,000',
    tracks: [
      {
        trackId,
        type: 'MultiWaySyntenyDisplay',
        domain: ['volvox_ins', 'volvox_del'],
      },
    ],
  })
  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
      expect(view.tracks.length).toBe(1)
    },
    { timeout: 30000 },
  )

  const track = view.tracks[0]!
  const display = track.displays[0] as MultiWaySyntenyDisplayModel
  expect(display.type).toBe('MultiWaySyntenyDisplay')

  await waitFor(
    () => {
      expect(display.groups.length).toBeGreaterThan(0)
      expect(
        display.laneLinks?.get('volvox_ins|volvox_del')?.links.length,
      ).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
  return { track, display }
}

test('MultiWaySyntenyDisplay on a multi-genome PAF groups per record and fetches adjacent-pair links', async () => {
  const { display } = await openMultiWay('volvox_all_vs_all')

  expect(display.featuresAreNameless).toBe(true)
  // the anchor assembly never gets its own lane, even when paralogy records
  // name it as a mate
  expect(display.rowAssemblies).toEqual(['volvox_ins', 'volvox_del'])

  const link = display.laneLinks!.get('volvox_ins|volvox_del')!.links[0]!
  expect((link.get('mate') as { assemblyName: string }).assemblyName).toBe(
    'volvox_del',
  )
}, 60000)
