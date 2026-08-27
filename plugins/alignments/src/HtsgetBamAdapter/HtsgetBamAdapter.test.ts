import { getFetcher } from '@jbrowse/core/util/io'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import HtsgetBamAdapter from './HtsgetBamAdapter.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  getFetcher: jest.fn(() => async () => new Response()),
}))

const pluginManager = {} as PluginManager

function adapter(snap: Record<string, unknown>) {
  return new HtsgetBamAdapter(
    configSchema.create({ type: 'HtsgetBamAdapter', ...snap }),
    undefined,
    pluginManager,
  )
}

function configure(snap: Record<string, unknown>) {
  // @ts-expect-error protected
  return adapter(snap).configure()
}

beforeEach(() => {
  jest.mocked(getFetcher).mockClear()
})

// The scoping itself lives in getFetcher (see
// packages/core/src/util/io/getFetcherScope.test.ts); what this side owes is
// asking for it at all. HtsgetFile was built with no `fetch` for years, so an
// endpoint behind auth could not be read and a 401 raised no prompt.
test('the adapter builds its bam with a fetcher for htsgetBase', () => {
  configure({
    htsgetBase: 'https://htsget.example.com/reads',
    htsgetTrackId: 'NA12878',
  })

  expect(getFetcher).toHaveBeenCalledWith(
    expect.objectContaining({ uri: 'https://htsget.example.com/reads' }),
    pluginManager,
  )
})

// The whole point of the slot being a location: `serializeArguments` finds what
// needs pre-authorization by walking the args for a `uri`, so a string spelling
// ships no token and every worker-driver product reads the endpoint
// unauthenticated. The location has to survive readConfObject to be walkable.
test('htsgetBase reads back as a location, which is what the pre-auth walk looks for', () => {
  const conf = configSchema.create({
    type: 'HtsgetBamAdapter',
    htsgetBase: 'https://htsget.example.com/reads',
    htsgetTrackId: 'NA12878',
  })

  // the snapshot, because that is the shape that crosses into the worker and
  // the shape walkLocationObjects walks
  expect(getSnapshot(conf).htsgetBase).toEqual({
    uri: 'https://htsget.example.com/reads',
    locationType: 'UriLocation',
  })
})

test('a location spelling of htsgetBase is taken as written', () => {
  configure({
    htsgetBase: {
      uri: 'https://htsget.example.com/reads',
      locationType: 'UriLocation',
      internetAccountId: 'myLab',
    },
    htsgetTrackId: 'NA12878',
  })

  expect(getFetcher).toHaveBeenCalledWith(
    expect.objectContaining({ internetAccountId: 'myLab' }),
    pluginManager,
  )
})

// @gmod/bam concatenates baseUrl and trackId and has no baseUri of its own, so
// a relative endpoint has to be resolved before it gets there
test('a relative htsgetBase is resolved against its baseUri', () => {
  configure({
    htsgetBase: {
      uri: 'reads',
      baseUri: 'https://mysite.example.com/config.json',
      locationType: 'UriLocation',
    },
    htsgetTrackId: 'NA12878',
  })

  expect(getFetcher).toHaveBeenCalledWith(
    expect.objectContaining({ uri: 'reads' }),
    pluginManager,
  )
})

// htsgetBase defaults to an empty uri, and getFetcher rejects a falsy one, so
// without this a track missing it died naming a UriLocation the config never
// wrote
test('a config with no htsgetBase names the slot it is missing', () => {
  expect(() => configure({ htsgetTrackId: 'NA12878' })).toThrow(/htsgetBase/)
})
