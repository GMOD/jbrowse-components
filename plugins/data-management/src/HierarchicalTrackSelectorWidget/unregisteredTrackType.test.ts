import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { HierarchicalTrackSelectorModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function trackConf(trackId: string, type: string) {
  return {
    trackId,
    name: trackId,
    type,
    assemblyNames: ['volMyt1'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
}

// A track type nothing registers is what a config gets when the plugin
// supplying it fails to load — a CDN that is down, a version mismatch, or a
// plugin dropped from the config with its tracks left behind. The frozen config
// never passes through the schema that would have rejected it (ADR-032), so it
// reaches the selector intact.
async function setup() {
  const session = createTestSession({
    adminMode: true,
    jbrowseConfig: {
      tracks: [
        trackConf('fromMissingPlugin', 'SomeUnregisteredTrackType'),
        trackConf('ordinary', 'FeatureTrack'),
      ],
    },
  })
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'volMyt1-seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  })
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  return {
    session,
    model: view.activateTrackSelector() as HierarchicalTrackSelectorModel,
  }
}

// getTrackType throws on a name no plugin registered, and it was called from
// inside the computed the whole tree reads — so one unopenable track took out
// the entire selector, every other track with it.
test('an unregistered track type drops its own row, not the selector', async () => {
  const { session, model } = await setup()
  // the config kept it: nothing validates a frozen track config at load
  expect(session.tracks.map(t => t.trackId as string)).toContain(
    'fromMissingPlugin',
  )

  expect(
    model.allTracks.flatMap(g => g.tracks.map(t => t.conf.trackId as string)),
  ).toEqual(['volMyt1-seq', 'ordinary'])
})

// the same call reached from the faceted selector's source list and from
// favorites, so the guard has to sit under all of them
test('the unopenable track is absent from every list the selector builds', async () => {
  const { model } = await setup()
  expect(model.allTrackConfigurationMap.has('fromMissingPlugin')).toBe(false)
  expect(model.rows.length).toBeGreaterThan(0)
})
