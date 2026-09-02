// The target axis is in the fetch key whether or not the bidirectional fetch
// sends it: the worker culls geometry against the LOWER row's viewport too, so a
// pan of that row past its buffer stales the held ribbons exactly as a pan of
// the upper one does. `targetWindowRegions` is the one snapped window both
// `fetchRegionsKey` and `targetFetchRegions` read, and this is the test that
// keeps the obvious cleanup — pointing the key at `targetFetchRegions`, which is
// [] with the setting off — from landing quietly.
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

async function openSynteny() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId: 'vol_synteny',
    name: 'vol synteny',
    assemblyNames: ['volvox', 'volvox2'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox',
      targetAssembly: 'volvox2',
    },
  })
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
    tracks: ['vol_synteny'],
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  await when(() => view.levels[0]?.tracks.length === 1, { timeout: 5000 })
  const track = view.levels[0]!.tracks[0] as {
    displays: { fetchRegionsKey: string | undefined }[]
  }
  return { view, display: track.displays[0]! }
}

test('a pan of the lower row past its buffer moves the key with the bidirectional fetch off', async () => {
  const { view, display } = await openSynteny()
  expect(view.bidirectionalFetch).toBe(false)
  const lower = view.views[1]!
  lower.navTo({ refName: 'ctgA', start: 8000, end: 8800 })
  const before = display.fetchRegionsKey
  expect(before).toBeDefined()

  // inside the 2000 bp snapped buffer: the same window, the same key
  lower.horizontalScroll(100)
  expect(display.fetchRegionsKey).toBe(before)

  lower.horizontalScroll(5000)
  expect(display.fetchRegionsKey).not.toBe(before)
}, 20000)
