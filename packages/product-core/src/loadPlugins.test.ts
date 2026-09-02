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

const jbrowseVersion = '4.3.0'

const defs: UMDLocPluginDefinition[] = [
  { name: 'MafViewer', umdLoc: { uri: 'https://example.com/maf.js' } },
  { name: 'UCSC', umdLoc: { uri: 'https://example.com/ucsc.js' } },
]

afterEach(() => {
  jest.restoreAllMocks()
})

test('dropVendored filters a bundled plugin a config still names', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins(defs, { dropVendored: true, jbrowseVersion })
  expect(calls[0]!.names).toEqual(['UCSC'])
})

test('a product that does not bundle them still fetches one', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins(defs, { dropVendored: false, jbrowseVersion })
  expect(calls[0]!.names).toEqual(['MafViewer', 'UCSC'])
})

// each of these passes a definition, because a definition is what makes a
// loader exist at all now — see 'a config that names nothing loads nothing'
test('baseUri resolves relative plugin urls', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins(defs, {
    dropVendored: true,
    jbrowseVersion,
    baseUri: 'https://example.com/config.json',
  })
  expect(calls[0]!.baseUri).toBe('https://example.com/config.json')
})

test('baseUrl is still accepted as the pre-4.4 spelling', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins(defs, {
    dropVendored: true,
    jbrowseVersion,
    baseUrl: 'https://example.com/config.json',
  })
  expect(calls[0]!.baseUri).toBe('https://example.com/config.json')
})

test('with neither, urls resolve against the page rather than throwing', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins(defs, { dropVendored: true, jbrowseVersion })
  expect(calls[0]!.baseUri).toBe(window.location.href)
})

// `loadSettled` publishes the runtime re-export ABI on the way past, and that
// registry names React, react-dom/client and Material UI. Nothing can call
// `jbrequire` without a runtime plugin, so a host whose config names none must
// not reach the loader at all.
test('a config that names nothing loads nothing', async () => {
  const calls = captureLoad()
  await loadRuntimePlugins([], { dropVendored: true, jbrowseVersion })
  expect(calls).toEqual([])
})

// The order at this seam is load-bearing: dropVendoredPlugins matches on the UMD
// name, which a store ref only acquires from the manifest, so resolving second
// would install a second MafViewer beside the one core already bundles.
describe('store refs', () => {
  function mockStore(plugins: unknown[]) {
    return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plugins }),
    } as Response)
  }

  const mafviewer = {
    name: 'MafViewer',
    packageName: 'jbrowse-plugin-mafviewer',
    authors: [],
    description: '',
    location: '',
    license: '',
    url: 'https://jbrowse.org/plugins/jbrowse-plugin-mafviewer/1.0.0/dist/m.js',
    versions: [
      {
        pluginVersion: '1.0.0',
        jbrowseRange: '*',
        url: 'https://jbrowse.org/plugins/jbrowse-plugin-mafviewer/1.0.0/dist/m.js',
      },
    ],
  }

  it('resolves before dropping vendored, so a ref to one is still dropped', async () => {
    mockStore([mafviewer])
    const calls = captureLoad()
    await loadRuntimePlugins([{ storePlugin: 'MafViewer' }], {
      dropVendored: true,
      jbrowseVersion,
    })
    // dropped down to nothing, so there is nothing to load
    expect(calls).toEqual([])
  })

  it('fetches nothing when no definition is a ref', async () => {
    const fetchSpy = mockStore([])
    captureLoad()
    await loadRuntimePlugins(defs, { dropVendored: true, jbrowseVersion })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // this path ends in `load`, which is all-or-nothing, so a ref the store has no
  // build for must not become a plugin the embedder silently never receives
  it('throws rather than silently dropping an unresolvable ref', async () => {
    mockStore([])
    captureLoad()
    await expect(
      loadRuntimePlugins([{ storePlugin: 'Nope' }], {
        dropVendored: true,
        jbrowseVersion,
      }),
    ).rejects.toThrow(/not in the plugin store/)
  })
})
