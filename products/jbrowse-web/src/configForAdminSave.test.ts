import { readQueryParams } from '@jbrowse/app-core'

import { prefetchConfig } from './prefetchConfig.ts'
import { configForAdminSave, resolveConfigPath } from './resolveConfigPath.ts'
import { fetchRemoteConfig } from './sessionLoaderHelpers.ts'

const authored = {
  assemblies: [
    {
      name: 'volvox',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox_refseq',
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: { uri: 'volvox.2bit', locationType: 'UriLocation' },
        },
      },
    },
  ],
  tracks: [
    {
      type: 'FeatureTrack',
      trackId: 'genes',
      adapter: {
        type: 'BigBedAdapter',
        bigBedLocation: {
          uri: 'genes.bb',
          baseUri: 'https://elsewhere.org/data/',
          locationType: 'UriLocation',
        },
      },
    },
  ],
}

afterEach(() => {
  window.__jbrowseEarlyConfig = undefined
})

test.each(['/?config=data/config.json', '/', '/app/?config=../conf/c.json'])(
  'the admin save at %s writes back the config the load read',
  async url => {
    window.history.replaceState(null, '', url)
    const configParam = readQueryParams(['config']).config
    window.__jbrowseEarlyConfig = {
      configPath: resolveConfigPath(configParam),
      config: Promise.resolve(structuredClone(authored)),
    }
    prefetchConfig()
    const { config } = await fetchRemoteConfig(resolveConfigPath(configParam))

    expect(JSON.stringify(config)).toContain('"baseUri":"http://localhost/')
    expect(configForAdminSave(config, configParam)).toEqual(authored)
  },
)
