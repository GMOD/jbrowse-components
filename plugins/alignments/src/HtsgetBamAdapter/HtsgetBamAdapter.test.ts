import { getFetcher } from '@jbrowse/core/util/io'

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

beforeEach(() => {
  jest.mocked(getFetcher).mockClear()
})

// The scoping itself lives in getFetcher (see
// packages/core/src/util/io/getFetcherScope.test.ts); what this side owes is
// asking for it at all. HtsgetFile was built with no `fetch` for years, so an
// endpoint behind auth could not be read and a 401 raised no prompt.
test('the adapter builds its bam with a fetcher scoped to htsgetBase', () => {
  adapter({
    htsgetBase: 'https://htsget.example.com/reads',
    htsgetTrackId: 'NA12878',
  })
    // @ts-expect-error protected
    .configure()

  expect(getFetcher).toHaveBeenCalledWith(
    { uri: 'https://htsget.example.com/reads', locationType: 'UriLocation' },
    pluginManager,
  )
})

// htsgetBase defaults to '', and getFetcher rejects a falsy uri, so without this
// a track missing it died inside getFetcher naming a UriLocation the config
// never wrote
test('a config with no htsgetBase names the slot it is missing', () => {
  expect(() =>
    adapter({ htsgetTrackId: 'NA12878' })
      // @ts-expect-error protected
      .configure(),
  ).toThrow(/htsgetBase/)
})
