import PluginLoader from './PluginLoader.ts'

const PACKAGED_PAGE = 'file:///opt/JBrowse/resources/app/index.html'
const DEV_SERVER_PAGE = 'http://localhost:3000/'

function recordingLoader(
  definitions: ConstructorParameters<typeof PluginLoader>[0],
) {
  const loaded: string[] = []
  const loader = new PluginLoader(definitions, {
    fetchESM: url => {
      loaded.push(url)
      return Promise.resolve({ default: class P {} as never })
    },
  })
  return { loader, loaded }
}

// test_data/volvox names its plugin `{ uri: 'plugin.js' }`, and Desktop opening
// that config from disk rewrites it to the file beside the config
const besideConfig = {
  name: 'Local',
  esmLoc: { uri: 'file:///data/volvox/plugin.js' },
}

test('a packaged Desktop loads a plugin beside a config opened from disk', async () => {
  const { loader, loaded } = recordingLoader([besideConfig])
  const { failures } = await loader.loadSettled(PACKAGED_PAGE)

  expect(failures).toEqual([])
  expect(loaded).toEqual(['file:///data/volvox/plugin.js'])
})

// the worker of an http page cannot import a file: script, and a plugin the
// page loaded but the worker could not left every RPC on a terminated worker
test('an http page refuses it, so page and worker agree', async () => {
  const { loader, loaded } = recordingLoader([besideConfig])
  const { failures } = await loader.loadSettled(DEV_SERVER_PAGE)

  expect(`${failures[0]!.error}`).toMatch(/only in a packaged JBrowse Desktop/)
  expect(loaded).toEqual([])
})

// a relative url resolves against the app's own files, which ship no plugins,
// and an explicit file: url names nothing the user opened
test('a packaged Desktop still refuses other file: plugin urls', async () => {
  const { loader, loaded } = recordingLoader([
    { name: 'Relative', esmUrl: 'plugin.js' },
    { name: 'Explicit', esmUrl: 'file:///etc/plugin.js' },
  ])
  const { failures } = await loader.loadSettled(PACKAGED_PAGE)

  expect(failures.map(f => `${f.error}`)).toEqual([
    expect.stringMatching(/relative url "plugin\.js"/),
    expect.stringMatching(/protocol "file:"/),
  ])
  expect(loaded).toEqual([])
})

// a link's sessionPlugins or a config built in code carries no baseUri
test('an esmLoc with nothing to resolve against says so', async () => {
  const { loader } = recordingLoader([
    { name: 'Bare', esmLoc: { uri: 'plugin.js' } },
  ])
  const { failures } = await loader.loadSettled(PACKAGED_PAGE)

  expect(`${failures[0]!.error}`).toMatch(/"plugin\.js": it is not a url/)
})
