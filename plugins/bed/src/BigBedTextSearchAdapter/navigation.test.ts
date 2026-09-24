import { parseLocString } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function local(file: string) {
  return {
    localPath: require.resolve(`./test_data/${file}`),
    locationType: 'LocalPathLocation' as const,
  }
}

async function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [{ type: 'LinearGenomeView', displayedRegions: [], tracks: [] }],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 50001, seq: '' },
          { refName: 'ctgB', uniqueId: 'b', start: 0, end: 6079, seq: '' },
        ],
      },
    },
  })
  // what a UCSC hub connection builds for a track declaring searchIndex and
  // searchTrix: the index records name features, never the track
  session.addSessionTrackConf({
    trackId: 'hub_genes',
    name: 'genes',
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: { type: 'BigBedAdapter', bigBedLocation: local('genes.bb') },
    textSearching: {
      textSearchAdapter: {
        type: 'BigBedTextSearchAdapter',
        bigBedLocation: local('genes.bb'),
        ixFilePath: local('genes.ix'),
        ixxFilePath: local('genes.ixx'),
      },
    },
  })
  await session.assemblyManager.waitForAssembly('volvox')
  return session.views[0]
}

test('a gene name lands on the gene and opens the hub track it came from', async () => {
  const view = await setup()

  expect(await view.navToLocString('eden', 'volvox')).toBe(true)

  const { refName, start, end } = parseLocString(
    view.visibleLocStrings,
    refName => refName === 'ctgA',
  )
  expect(refName).toBe('ctgA')
  expect(start).toBeLessThanOrEqual(1050)
  expect(end).toBeGreaterThanOrEqual(9500)
  expect(
    view.tracks.map(
      (t: { configuration: { trackId: string } }) => t.configuration.trackId,
    ),
  ).toEqual(['hub_genes'])
})

test('Enter on a word the query only prefixes lands on its gene', async () => {
  const view = await setup()

  expect(await view.navToLocString('ed', 'volvox')).toBe(true)

  const { refName, start, end } = parseLocString(
    view.visibleLocStrings,
    refName => refName === 'ctgA',
  )
  expect(refName).toBe('ctgA')
  expect(start).toBeLessThanOrEqual(1050)
  expect(end).toBeGreaterThanOrEqual(9500)
})
