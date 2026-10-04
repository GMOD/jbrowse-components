import { parseLocString } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { waitFor } from '@testing-library/react'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function navAndLoad(view: any, query: string) {
  const moved = await view.navToLocString(query, 'volvox')
  await waitFor(() => {
    expect(view.tracks[0].displays[0].rpcDataMap.size).toBe(1)
  })
  return moved
}

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
  // searchTrix: the index records name features, never the track, and the
  // transcripts gather into genes under the column the index names them by
  session.addSessionTrackConf({
    trackId: 'hub_genes',
    name: 'genes',
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: {
      type: 'BigBedAdapter',
      bigBedLocation: local('genes.bb'),
      aggregateField: 'name2',
    },
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

function expectEdenBoxed(view: any) {
  const display = view.tracks[0].displays[0]
  expect(display.featureHighlights.map((h: object) => ({ ...h }))).toEqual([
    { refName: 'ctgA', start: 1049, end: 9500, name: 'EDEN' },
  ])
  const boxed = [...display.highlightedFeatureIdSet]
  expect(boxed).toHaveLength(1)
  expect(boxed[0]).toMatch(/bb-745-0-parent$/)
}

test('a gene name lands on the gene and opens the hub track it came from', async () => {
  const view = await setup()

  expect(await navAndLoad(view, 'eden')).toBe(true)

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
  expectEdenBoxed(view)
})

test('Enter on a word the query only prefixes lands on its gene', async () => {
  const view = await setup()

  expect(await navAndLoad(view, 'ed')).toBe(true)

  const { refName, start, end } = parseLocString(
    view.visibleLocStrings,
    refName => refName === 'ctgA',
  )
  expect(refName).toBe('ctgA')
  expect(start).toBeLessThanOrEqual(1050)
  expect(end).toBeGreaterThanOrEqual(9500)
  expectEdenBoxed(view)
})
