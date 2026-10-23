/**
 * @jest-environment node
 */

import { parseArgs } from './args.ts'
import { resolveAgainstConfig } from './catalog.ts'
import { jbrowseUrl } from './url.ts'

const search = (name: string) => ({
  type: 'TrixTextSearchAdapter',
  textSearchAdapterId: `${name}-index`,
  ixFilePath: { uri: `trix/${name}.ix` },
  assemblyNames: [name],
})

const genes = (name: string) => ({
  trackId: `${name}-ncbiRefSeq`,
  type: 'FeatureTrack',
  assemblyNames: [name],
})

const liftOver = (target: string, query: string) => ({
  trackId: `${target}_to_${query}_liftOver`,
  type: 'SyntenyTrack',
  assemblyNames: [target, query],
  adapter: { pifGzLocation: { uri: `liftOver/${target}To${query}.pif.gz` } },
})

const hostedConfigs: Record<string, object> = {
  'https://jbrowse.org/ucsc/hg38/config.json': {
    assemblies: [{ name: 'hg38', sequence: {} }],
    tracks: [genes('hg38'), liftOver('hg38', 'mm39')],
    aggregateTextSearchAdapters: [search('hg38')],
  },
  'https://jbrowse.org/ucsc/mm39/config.json': {
    assemblies: [{ name: 'mm39', sequence: { adapter: { uri: 'mm39.2bit' } } }],
    tracks: [genes('mm39'), liftOver('mm39', 'hg38'), liftOver('mm39', 'hs1')],
    aggregateTextSearchAdapters: [search('mm39')],
  },
  // no liftOver of its own, and no search index
  'https://jbrowse.org/ucsc/hs1/config.json': {
    assemblies: [{ name: 'hs1', sequence: {} }],
    tracks: [genes('hs1')],
  },
}

beforeEach(() => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(input => {
    const config = hostedConfigs[String(input)]
    return Promise.resolve(
      config
        ? Response.json(structuredClone(config))
        : new Response('', { status: 404 }),
    )
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

const comparativeOf = (line: string) => parseArgs(line.split(' ')).comparative

test('a second --genome, or a view word, makes the rows of a comparative view', () => {
  expect(
    comparativeOf('--genome hg38 loc:HOXA1 --genome mm39 --out x.png'),
  ).toEqual({
    type: 'LinearSyntenyView',
    rows: [{ assembly: 'hg38', loc: 'HOXA1' }, { assembly: 'mm39' }],
    hosted: ['hg38', 'mm39'],
  })
  expect(comparativeOf('url dotplot --genome hg38 --genome mm39')?.type).toBe(
    'DotplotView',
  )
  expect(comparativeOf('--genome hg38 --loc chr1:1-100')).toBeUndefined()
  expect(() => comparativeOf('dotplot --genome hg38')).toThrow(
    'a dotplot compares two genomes, and this command line names 1',
  )
})

test('the top row is the page config, the rest ride in the spec', async () => {
  const resolved = await resolveAgainstConfig({
    comparative: comparativeOf(
      '--genome hg38 loc:HOXA1 --genome mm39 loc:Hoxa1',
    ),
    view: { mark: { interpolate: 'bump' } },
  })
  expect(resolved.genome).toBe('hg38')
  expect(resolved.spec).toEqual({
    sessionAssemblies: [
      {
        name: 'mm39',
        sequence: {
          adapter: {
            uri: 'mm39.2bit',
            baseUri: 'https://jbrowse.org/ucsc/mm39/config.json',
          },
        },
      },
    ],
    // the comparison hg38's config already holds stays there; mm39's gene
    // search rides on one of mm39's own tracks
    sessionTracks: [
      {
        ...genes('mm39'),
        textSearching: {
          textSearchAdapter: {
            ...search('mm39'),
            ixFilePath: {
              uri: 'trix/mm39.ix',
              baseUri: 'https://jbrowse.org/ucsc/mm39/config.json',
            },
          },
        },
      },
    ],
    views: [
      {
        mark: { interpolate: 'bump' },
        type: 'LinearSyntenyView',
        views: [
          { assembly: 'hg38', loc: 'HOXA1' },
          { assembly: 'mm39', loc: 'Hoxa1' },
        ],
        tracks: ['hg38_to_mm39_liftOver'],
      },
    ],
  })
  expect(jbrowseUrl(resolved)).toMatch(
    /#config=https%3A%2F%2Fjbrowse.org%2Fucsc%2Fhg38%2Fconfig.json&session=spec-/,
  )
})

test("a comparison the page's config lacks joins the spec, located by its own config", async () => {
  const { spec } = await resolveAgainstConfig({
    comparative: comparativeOf('--genome hs1 --genome mm39'),
  })
  const { sessionTracks } = spec as { sessionTracks: { trackId: string }[] }
  expect(sessionTracks.map(t => t.trackId)).toEqual([
    'mm39_to_hs1_liftOver',
    'mm39-ncbiRefSeq',
  ])
  expect(sessionTracks[0]).toMatchObject({
    adapter: {
      pifGzLocation: {
        uri: 'liftOver/mm39Tohs1.pif.gz',
        baseUri: 'https://jbrowse.org/ucsc/mm39/config.json',
      },
    },
  })
})

test('linear options, and an unresolved view, are refused', async () => {
  const comparative = comparativeOf('--genome hg38 --genome mm39')
  await expect(
    resolveAgainstConfig({ comparative, loc: 'chr1', tracks: ['genes'] }),
  ).rejects.toThrow(
    'a synteny view or dotplot opens one row per --genome, at its loc:; --loc, --track apply to a linear view',
  )
  expect(() => jbrowseUrl({ comparative })).toThrow(
    /pass the options through resolveAgainstConfig first/,
  )
})
