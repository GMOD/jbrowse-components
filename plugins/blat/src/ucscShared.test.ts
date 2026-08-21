import { addResultTrack, featureLocString } from './ucscShared.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

// the locstring a result link navigates to is the whole point of the search, so
// the interbase -> 1-based conversion is worth pinning: a PSL tStart of 7579838
// is base 7,579,839
test('converts an interbase feature to a 1-based locstring', () => {
  expect(
    featureLocString({
      uniqueId: 'blat-0',
      refName: 'chr17',
      start: 7579838,
      end: 7579985,
    }),
  ).toBe('chr17:7579839-7579985')
})

const features: SimpleFeatureSerialized[] = [
  { uniqueId: 'hit-0', refName: 'chr17', start: 7579838, end: 7579985 },
  { uniqueId: 'hit-1', refName: 'chr6', start: 100, end: 200 },
]

// The guards addResultTrack goes through (isSessionWithAddSessionTrack,
// isSessionModelWithWidgets, isNavigableView) are duck typed, so a plain object
// with the right keys is a real session as far as they are concerned. One cast
// stands in for the whole MST model rather than building one for four calls.
function fakeSession() {
  const calls = {
    addedTracks: [] as Record<string, unknown>[],
    shownTracks: [] as string[],
    navigated: [] as string[],
    widgets: [] as Record<string, unknown>[],
    notifications: [] as string[],
  }
  const session = {
    rpcManager: {},
    configuration: {},
    widgets: new Map(),
    views: [
      {
        type: 'LinearGenomeView',
        assemblyNames: ['hg19'],
        showTrack: (trackId: string) => calls.shownTracks.push(trackId),
        navToLocString: (loc: string) => {
          calls.navigated.push(loc)
          return Promise.resolve()
        },
      },
    ],
    addSessionTrackConf: (conf: Record<string, unknown>) => {
      calls.addedTracks.push(conf)
      return conf
    },
    addWidget: (_type: string, _id: string, args: Record<string, unknown>) =>
      args,
    showWidget: (widget: Record<string, unknown>) => calls.widgets.push(widget),
    notify: (message: string) => calls.notifications.push(message),
  }
  return { session: session as unknown as AbstractSessionModel, calls }
}

// The deliberate behavior, and the one most likely to be "helpfully" undone: a
// query adds its track and lists its results, and leaves the view alone. Which
// result matters is the user's call, and the server's first is not their intent.
test('adds and shows the track without moving the view', async () => {
  const { session, calls } = fakeSession()
  await addResultTrack({
    session,
    assembly: 'hg19',
    features,
    trackIdPrefix: 'blat',
    trackName: 'BLAT test',
  })
  expect(calls.addedTracks).toHaveLength(1)
  expect(calls.addedTracks[0]).toMatchObject({
    name: 'BLAT test',
    assemblyNames: ['hg19'],
  })
  expect(calls.shownTracks).toHaveLength(1)
  expect(calls.shownTracks[0]).toBe(calls.addedTracks[0]!.trackId)
  expect(calls.navigated).toEqual([])
})

test('opens the results widget with every result and its noun', async () => {
  const { session, calls } = fakeSession()
  await addResultTrack({
    session,
    assembly: 'hg19',
    features,
    trackIdPrefix: 'ispcr',
    trackName: 'PCR test',
    resultNoun: 'product',
  })
  expect(calls.widgets).toHaveLength(1)
  expect(calls.widgets[0]).toMatchObject({
    assembly: 'hg19',
    trackName: 'PCR test',
    resultNoun: 'product',
  })
  expect(calls.widgets[0]!.features).toHaveLength(features.length)
})

// hgPcr's products need no display override, so the default stays a feature track
test('defaults to a FromConfigAdapter feature track, and takes an override', async () => {
  const plain = fakeSession()
  await addResultTrack({
    session: plain.session,
    assembly: 'hg19',
    features,
    trackIdPrefix: 'ispcr',
    trackName: 'PCR test',
  })
  expect(plain.calls.addedTracks[0]).toMatchObject({
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter' },
  })

  const overridden = fakeSession()
  await addResultTrack({
    session: overridden.session,
    assembly: 'hg19',
    features,
    trackIdPrefix: 'ispcr',
    trackName: 'PCR test',
    trackConf: {
      type: 'AlignmentsTrack',
      adapter: { type: 'SamAdapter', samText: '@HD\tVN:1.6\n' },
      displayDefaults: { showCoverage: false },
    },
  })
  expect(overridden.calls.addedTracks[0]).toMatchObject({
    type: 'AlignmentsTrack',
    adapter: { type: 'SamAdapter' },
    displayDefaults: { showCoverage: false },
  })
})

// a hit on an assembly no open view shows still belongs in the session, said
// once rather than swallowed
test('reports a missing view instead of throwing', async () => {
  const { session, calls } = fakeSession()
  await addResultTrack({
    session,
    assembly: 'mm10',
    features,
    trackIdPrefix: 'blat',
    trackName: 'BLAT test',
  })
  expect(calls.addedTracks).toHaveLength(1)
  expect(calls.shownTracks).toEqual([])
  expect(calls.notifications).toHaveLength(1)
  expect(calls.notifications[0]).toContain('mm10')
})
