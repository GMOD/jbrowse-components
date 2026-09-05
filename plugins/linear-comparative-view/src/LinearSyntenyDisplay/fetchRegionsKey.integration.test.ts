// The target axis is in the fetch key whether or not the bidirectional fetch
// queries it: the worker emits geometry for the LOWER row's window too, so a
// pan of that row past its buffer stales the held ribbons exactly as a pan of
// the upper one does. `targetWindowRegions` is the one snapped window the key
// and the RPC both read, and this is the test that keeps the obvious cleanup —
// leaving the lower row out of the key when the setting is off — from landing
// quietly.
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

// The corners the worker emitted are relative to the region layout it was
// given, so after a rewrite of a row's region list the held geometry draws at
// loci that no longer exist. A pan keeps it; a region change drops it. The
// feature lanes name loci in bp and stay, because the follow walks them to
// place the other row from exactly such a rewrite.
test('a rewritten region list drops the held geometry and keeps the features, a pan keeps both', async () => {
  const { view, display } = await openSynteny()
  const d = display as unknown as {
    instanceData: unknown
    featureData: unknown
    setRpcData: (a: unknown, b: unknown) => void
  }
  d.setRpcData(
    {
      attributeRanges: [],
      featureIds: [],
      starts: new Float64Array(0),
      ends: new Float64Array(0),
    },
    { instanceCount: 0 },
  )
  expect(d.instanceData).toBeDefined()
  view.views[0]!.horizontalScroll(100)
  expect(d.instanceData).toBeDefined()
  view.views[0]!.horizontallyFlip()
  expect(d.instanceData).toBeUndefined()
  expect(d.featureData).toBeDefined()
})
