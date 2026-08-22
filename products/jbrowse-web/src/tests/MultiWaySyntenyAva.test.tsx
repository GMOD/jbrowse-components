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

test('MultiWaySyntenyDisplay on an all-vs-all PAF groups per record and fetches adjacent-pair links', async () => {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    init: {
      assembly: 'volvox',
      loc: 'ctgA:1-50,000',
      tracks: [
        {
          trackId: 'volvox_all_vs_all',
          type: 'MultiWaySyntenyDisplay',
          rowOrder: ['volvox_ins', 'volvox_del'],
        },
      ],
    },
  })
  view.setWidth(800)

  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
      expect(view.tracks.length).toBe(1)
    },
    { timeout: 30000 },
  )

  const display = view.tracks[0]!.displays[0] as MultiWaySyntenyDisplayModel
  expect(display.type).toBe('MultiWaySyntenyDisplay')

  await waitFor(
    () => {
      expect(display.groups.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )

  expect(display.featuresAreNameless).toBe(true)
  // the anchor assembly never gets its own lane, even when paralogy records
  // name it as a mate
  expect(display.rowAssemblies).toEqual(['volvox_ins', 'volvox_del'])

  await waitFor(
    () => {
      expect(
        display.laneLinks?.get('volvox_ins|volvox_del')?.length,
      ).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
  const link = display.laneLinks!.get('volvox_ins|volvox_del')![0]!
  expect((link.get('mate') as { assemblyName: string }).assemblyName).toBe(
    'volvox_del',
  )
}, 60000)
