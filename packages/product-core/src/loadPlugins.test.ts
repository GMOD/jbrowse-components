import PluginLoader from '@jbrowse/core/PluginLoader'
import { isUMDPluginDefinition } from '@jbrowse/core/pluginDefinitions'

import { loadRuntimePlugins } from './loadPlugins.ts'

import type { UMDLocPluginDefinition } from '@jbrowse/core/pluginDefinitions'

// The three embedded products' `loadPlugins` are one-line wrappers over this,
// and before they were they had drifted in two ways that nothing caught:
// react-app's took no `baseUrl`, and the vendored-plugin filter differed. Both
// are pinned here, since a product's own wrapper has no body left to test.

function captureLoad() {
  const calls: { names: string[]; baseUri: string | undefined }[] = []
  jest.spyOn(PluginLoader.prototype, 'load').mockImplementation(async function (
    this: PluginLoader,
    baseUri?: string,
  ) {
    calls.push({
      names: this.definitions.filter(isUMDPluginDefinition).map(d => d.name),
      baseUri,
    })
    return []
  })
  return calls
}

const defs: UMDLocPluginDefinition[] = [
  { name: 'MafViewer', umdLoc: { uri: 'https://example.com/maf.js' } },
  { name: 'UCSC', umdLoc: { uri: 'https://example.com/ucsc.js' } },
]

afterEach(() => {
  jest.restoreAllMocks()
})

test('dropVendored filters a bundled plugin a config still names', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins(defs, { dropVendored: true })
  expect(calls[0]!.names).toEqual(['UCSC'])
})

test('a product that does not bundle them still fetches one', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins(defs, { dropVendored: false })
  expect(calls[0]!.names).toEqual(['MafViewer', 'UCSC'])
})

test('baseUri resolves relative plugin urls', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins([], {
    dropVendored: true,
    baseUri: 'https://example.com/config.json',
  })
  expect(calls[0]!.baseUri).toBe('https://example.com/config.json')
})

test('baseUrl is still accepted as the pre-4.4 spelling', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins([], {
    dropVendored: true,
    baseUrl: 'https://example.com/config.json',
  })
  expect(calls[0]!.baseUri).toBe('https://example.com/config.json')
})

test('with neither, urls resolve against the page rather than throwing', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins([], { dropVendored: true })
  expect(calls[0]!.baseUri).toBe(window.location.href)
})
