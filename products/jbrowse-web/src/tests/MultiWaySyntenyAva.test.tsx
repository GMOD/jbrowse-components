import { waitFor } from '@testing-library/react'

import volvoxConfig from '../../test_data/volvox/config.json' with { type: 'json' }
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

async function openMultiWay(trackId: string, config?: Record<string, unknown>) {
  const { rootModel } = await getPluginManager(config)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    assembly: 'volvox',
    loc: 'ctgA:1-50,000',
    tracks: [
      {
        trackId,
        type: 'MultiWaySyntenyDisplay',
        rowOrder: ['volvox_ins', 'volvox_del'],
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

// The two adapters were `AllVsAllPAFAdapter` and `AllVsAllIndexedPAFAdapter`
// until 2026-09, and hosted configs still say so. The old name is an alias on
// the AdapterType: the config loads, the adapter slot's snapshot reads the
// registered name, and the display draws what the renamed config draws.
function volvoxConfigSpelledTheOldWay() {
  const config = structuredClone(volvoxConfig)
  const oldNames = new Map([
    ['MultiGenomePAFAdapter', 'AllVsAllPAFAdapter'],
    ['MultiGenomeIndexedPAFAdapter', 'AllVsAllIndexedPAFAdapter'],
  ])
  let renamed = 0
  for (const track of config.tracks) {
    const oldName = oldNames.get(track.adapter.type)
    if (oldName) {
      track.adapter.type = oldName
      renamed++
    }
  }
  expect(renamed).toBe(2)
  return config
}

test.each([
  ['volvox_all_vs_all', 'MultiGenomePAFAdapter'],
  ['volvox_all_vs_all_indexed', 'MultiGenomeIndexedPAFAdapter'],
])(
  'a config still spelling %s the 2026-09 way loads as %s and draws the same links',
  async (trackId, canonical) => {
    const current = await openMultiWay(trackId)
    const legacy = await openMultiWay(trackId, volvoxConfigSpelledTheOldWay())

    expect(legacy.track.adapterConfig.type).toBe(canonical)
    expect(legacy.display.rowAssemblies).toEqual(current.display.rowAssemblies)
    expect(legacy.display.groups.length).toBe(current.display.groups.length)
    expect(
      legacy.display.laneLinks!.get('volvox_ins|volvox_del')!.links.length,
    ).toBe(
      current.display.laneLinks!.get('volvox_ins|volvox_del')!.links.length,
    )
  },
  120000,
)
