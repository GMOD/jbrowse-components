import { buildLgvInit, fetchRemoteConfig } from './sessionLoaderHelpers.ts'
import { configNeedsNoPrompt } from './trustedPlugins.ts'

test('buildLgvInit splits the regions param into displayedRegionNames', () => {
  expect(
    buildLgvInit({ assembly: 'hg38', regions: 'chr1,chr2,chr3' })
      .displayedRegionNames,
  ).toEqual(['chr1', 'chr2', 'chr3'])
})

test('buildLgvInit leaves displayedRegionNames undefined without a regions param', () => {
  expect(
    buildLgvInit({ assembly: 'hg38', loc: 'chr1:1-100' }).displayedRegionNames,
  ).toBeUndefined()
})

// jsdom serves the suite from http://localhost/
function serveConfigFrom(url: string) {
  jest.spyOn(global, 'fetch').mockImplementation(async () => {
    const response = Response.json({
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation: {
                uri: 'volvox.2bit',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
    })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
}

function stampedBaseUri(config: Record<string, unknown>) {
  return /"baseUri":"([^"]+)"/.exec(JSON.stringify(config))?.[1]
}

afterEach(() => {
  jest.restoreAllMocks()
})

test('a config redirected to another origin is judged and resolved by where it was served from', async () => {
  serveConfigFrom('https://elsewhere.example/data/config.json')
  const { config, configUri } = await fetchRemoteConfig('config.json')

  expect(configUri.href).toBe('https://elsewhere.example/data/config.json')
  expect(configNeedsNoPrompt(configUri, window.location)).toBe(false)
  expect(stampedBaseUri(config)).toBe(
    'https://elsewhere.example/data/config.json',
  )
})

test('a config served from where it was requested keeps the requested url', async () => {
  serveConfigFrom('http://localhost/data/config.json?rand=0.5')
  const { config, configUri } = await fetchRemoteConfig('data/config.json')

  expect(configUri.href).toBe('http://localhost/data/config.json')
  expect(configNeedsNoPrompt(configUri, window.location)).toBe(true)
  expect(stampedBaseUri(config)).toBe('http://localhost/data/config.json')
})
