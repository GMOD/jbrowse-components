import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { HierarchicalTrackSelectorModel } from './model.ts'

type TestSession = ReturnType<typeof createTestSession>

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function assemblyConf(name: string, aliases?: string[]) {
  return {
    name,
    aliases,
    sequence: {
      trackId: `${name}-seq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  }
}

function trackConf(trackId: string, assemblyNames: string[]) {
  return {
    trackId,
    name: trackId,
    type: 'FeatureTrack',
    assemblyNames,
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
}

// The assembly manager builds an Assembly model per config in an autorun, and
// until it has, a selector reads an empty assemblyNameMap — a window the app
// spends in a loading state and a test would otherwise spend asserting on the
// wrong answer.
//
// Worth stating exactly what the gate waits for, because the shape looked for a
// while like a MobX caching bug and is not one. `assemblyManagerAfterAttach` is
// created in `afterAttach`, so its FIRST run is a reaction scheduled to the end
// of the surrounding action rather than something that happens during setup.
// Instrumenting both ends gives, in order: `assemblyNameMap` computed over 0
// assemblies, then the autorun firing with an assemblyList of 1, then
// `assemblyNameMap` recomputed over 1. So the computed is not stale — it
// re-evaluates and answers correctly the moment anything asks again. Nothing
// asks again here, because `trackIds` reads `allTracks` once, imperatively,
// outside any reaction; the app re-reads through an observer and recovers on
// its own. Removing the gate therefore fails the two tests whose first read is
// their assertion, and leaves passing the one whose first read expects an empty
// list anyway.
//
// That is why this is a gate and not a workaround: the initialization really is
// asynchronous, and awaiting it is what a single imperative read has to do.
async function selectorFor(session: TestSession, assemblyName: string) {
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [{ assemblyName, refName: 'ctgA', start: 0, end: 1000 }],
  })
  return view.activateTrackSelector() as HierarchicalTrackSelectorModel
}

function trackIds(model: HierarchicalTrackSelectorModel) {
  return model.allTracks
    .flatMap(g => g.tracks.map(t => t.conf.trackId as string))
    .toSorted()
}

// dropping an unresolvable name left the view with no assemblies at all, and
// the "view declares no assemblies" escape hatch then let every track in the
// session through — a view on a missing assembly listed other assemblies'
// tracks instead of none of them
test('a view on an assembly the session lacks offers no tracks', async () => {
  const session = createTestSession({ adminMode: true })
  session.addAssemblyConf(assemblyConf('volMyt1'))
  session.addSessionTrackConf(trackConf('vt', ['volMyt1']))

  expect(trackIds(await selectorFor(session, 'ghost'))).toEqual([])
  expect(trackIds(await selectorFor(session, 'volMyt1'))).toEqual([
    'volMyt1-seq',
    'vt',
  ])
})

test('a track configured against an assembly alias still matches', async () => {
  const session = createTestSession({ adminMode: true })
  session.addAssemblyConf(assemblyConf('GRCh38', ['hg38']))
  session.addSessionTrackConf(trackConf('aliased', ['hg38']))

  expect(trackIds(await selectorFor(session, 'GRCh38'))).toEqual([
    'GRCh38-seq',
    'aliased',
  ])
})

// the faceted selector reads allTrackConfigurations; connection tracks used to
// reach it without going through filterTracks, so a connection's tracks for
// another assembly were listed (and turnable on) beside the config's filtered
// ones
test('a connection track for another assembly reaches neither selector', async () => {
  const session = createTestSession({
    adminMode: true,
    jbrowseConfig: {
      connections: [
        {
          connectionId: 'conn1',
          type: 'JBrowse1Connection',
          name: 'Conn',
          assemblyNames: ['other1'],
        },
      ],
    },
  })
  session.addAssemblyConf(assemblyConf('volMyt1'))
  session.addAssemblyConf(assemblyConf('other1'))
  // tracks in the initial snapshot, so the connection counts as live without
  // its connect() reaching for a URL
  session.makeConnection(session.connections[0]!, {
    tracks: [
      trackConf('otherAsmTrack', ['other1']),
      trackConf('sharedTrack', ['volMyt1']),
    ],
  })
  const model = await selectorFor(session, 'volMyt1')

  expect(trackIds(model)).toEqual(['sharedTrack', 'volMyt1-seq'])
  expect(model.allTrackConfigurations.map(t => t.trackId).toSorted()).toEqual([
    'sharedTrack',
    'volMyt1-seq',
  ])
})
