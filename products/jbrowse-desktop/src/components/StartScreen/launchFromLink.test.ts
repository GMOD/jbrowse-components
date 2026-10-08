import { aesEncrypt, toUrlSafeB64 } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import { launchFromLink } from './launchFromLink.ts'

import type { JBrowseConfig } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// loadSessionSpec drives real plugin extension points against a live root model;
// this exercises the link->config->spec wiring around it, so it stands in.
// (jest only allows a `mock`-prefixed binding inside a hoisted module factory.)
const mockLoadSessionSpec = jest.fn()
jest.mock('@jbrowse/app-core', () => ({
  ...jest.requireActual<object>('@jbrowse/app-core'),
  // called lazily: the factory is hoisted above the binding it closes over
  loadSessionSpec: (...args: unknown[]) => mockLoadSessionSpec(...args),
}))

const spec = {
  views: [{ type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-100' }],
}
const specLink = (query: string) =>
  `https://jbrowse.org/code/jb2/main/?${query}&session=spec-${encodeURIComponent(JSON.stringify(spec))}`
const link = `${specLink('config=test_data/volvox/config.json')}&sessionName=Figure`

const config: JBrowseConfig = {
  internetAccounts: [],
  assemblies: [{ name: 'volvox' }],
  tracks: [],
}
const pluginManager = {} as PluginManager
const trustPlugins = jest.fn()
const resolvedConfigUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'

beforeEach(() => {
  mockLoadSessionSpec.mockReset()
  trustPlugins.mockReset()
})

test('fetches the config the link names, then builds the spec session on it', async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  const result = await launchFromLink(link, {
    fetchConfig,
    createPluginManager,
    trustPlugins,
  })

  // the link's config is relative to the instance it points at
  expect(fetchConfig).toHaveBeenCalledWith(resolvedConfigUrl)
  expect(createPluginManager).toHaveBeenCalledWith(config)
  expect(mockLoadSessionSpec).toHaveBeenCalledWith(
    { ...spec, sessionName: 'Figure' },
    pluginManager,
  )
  expect(result).toBe(pluginManager)
})

// openSpecLink vets a remote config's plugins inside its fetchConfig, so a
// rejection there must strand the link before any plugin javascript is loaded —
// createPluginManager is what reaches PluginLoader.
test('a config rejected by its plugin gate never builds a plugin manager', async () => {
  const fetchConfig = jest.fn().mockRejectedValue(new Error('not trusted'))
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  await expect(
    launchFromLink(link, { fetchConfig, createPluginManager, trustPlugins }),
  ).rejects.toThrow('not trusted')

  expect(createPluginManager).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
})

test('a spec carrying its own assemblies needs no config fetch', async () => {
  const selfContained = {
    views: [{ type: 'LinearGenomeView', assembly: 'mine' }],
    sessionAssemblies: [{ name: 'mine' }],
  }
  const fetchConfig = jest.fn()
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  await launchFromLink(
    `https://jbrowse.org/code/jb2/main/?session=spec-${encodeURIComponent(JSON.stringify(selfContained))}`,
    { fetchConfig, createPluginManager, trustPlugins },
  )

  expect(fetchConfig).not.toHaveBeenCalled()
  expect(createPluginManager).toHaveBeenCalledWith(undefined)
  expect(mockLoadSessionSpec).toHaveBeenCalledWith(selfContained, pluginManager)
})

test('a link only its own instance can open fails before anything is built', async () => {
  const fetchConfig = jest.fn()
  const createPluginManager = jest.fn()

  await expect(
    launchFromLink('https://jbrowse.org/code/jb2/main/?session=local-abc', {
      fetchConfig,
      createPluginManager,
      trustPlugins,
    }),
  ).rejects.toThrow(/only the JBrowse Web instance that created it/)

  expect(fetchConfig).not.toHaveBeenCalled()
  expect(createPluginManager).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
})

test('a url that is itself a config opens it, with no spec to run', async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  const result = await launchFromLink(
    'https://jbrowse.org/ucsc/hg38/config.json',
    { fetchConfig, createPluginManager, trustPlugins },
  )

  expect(fetchConfig).toHaveBeenCalledWith(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(createPluginManager).toHaveBeenCalledWith(config)
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
  expect(result).toBe(pluginManager)
})

test('a spec on a .json url is still read as the spec link it is', async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  await launchFromLink(
    `https://jbrowse.org/ucsc/hg38/config.json?session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
    { fetchConfig, createPluginManager, trustPlugins },
  )

  expect(fetchConfig).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).toHaveBeenCalledWith(spec, pluginManager)
})

test('a link naming neither a config nor a view still reports why', async () => {
  const fetchConfig = jest.fn()
  const createPluginManager = jest.fn()

  await expect(
    launchFromLink('https://jbrowse.org/code/jb2/main/', {
      fetchConfig,
      createPluginManager,
      trustPlugins,
    }),
  ).rejects.toThrow(/no session in it/)

  expect(fetchConfig).not.toHaveBeenCalled()
})

test('a failed config fetch surfaces rather than building an empty session', async () => {
  const fetchConfig = jest.fn().mockRejectedValue(new Error('404 not found'))
  const createPluginManager = jest.fn()

  await expect(
    launchFromLink(link, { fetchConfig, createPluginManager, trustPlugins }),
  ).rejects.toThrow('404 not found')

  expect(createPluginManager).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
})

// What JBrowse Web's share button and genomes.jbrowse.org's protein browser
// write: the whole session in the link, here in the url hash as those do.
const snapshot = {
  name: 'Gene explorer: TP53',
  views: [{ id: 'lgv', type: 'LinearGenomeView' }],
  useWorkspaces: true,
}
const inlineLink = (
  session: object,
  config = 'config=%2Fucsc%2Fhg38%2Fconfig.json',
) =>
  `https://jbrowse.org/code/jb2/main/#${config}&session=json-${encodeURIComponent(JSON.stringify({ session }))}`

test("a link carrying its whole session opens it as the config's session", async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  const result = await launchFromLink(inlineLink(snapshot), {
    fetchConfig,
    createPluginManager,
    trustPlugins,
  })

  expect(fetchConfig).toHaveBeenCalledWith(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(createPluginManager).toHaveBeenCalledWith({
    ...config,
    plugins: [],
    defaultSession: snapshot,
  })
  expect(trustPlugins).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
  expect(result).toBe(pluginManager)
})

test("a session's own plugins are vetted, then loaded beside the config's", async () => {
  const sessionPlugins = [
    { name: 'Extra', url: 'https://example.com/extra.js' },
  ]
  const configPlugins = [{ name: 'MsaView', url: 'https://example.com/msa.js' }]
  const fetchConfig = jest
    .fn()
    .mockResolvedValue({ ...config, plugins: configPlugins })
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  await launchFromLink(inlineLink({ ...snapshot, sessionPlugins }), {
    fetchConfig,
    createPluginManager,
    trustPlugins,
  })

  expect(trustPlugins).toHaveBeenCalledWith(sessionPlugins)
  expect(createPluginManager).toHaveBeenCalledWith({
    ...config,
    plugins: [...configPlugins, ...sessionPlugins],
    defaultSession: snapshot,
  })
})

test('untrusted session plugins strand the link before anything is built', async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn()
  trustPlugins.mockRejectedValue(new Error('not trusted'))

  await expect(
    launchFromLink(
      inlineLink({
        ...snapshot,
        sessionPlugins: [{ name: 'Extra', url: 'x' }],
      }),
      { fetchConfig, createPluginManager, trustPlugins },
    ),
  ).rejects.toThrow('not trusted')

  expect(createPluginManager).not.toHaveBeenCalled()
})

test("a session's own connections stop the launch, since Desktop has no slot for them", async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn()

  await expect(
    launchFromLink(
      inlineLink({ ...snapshot, sessionConnections: [{ connectionId: 'a' }] }),
      { fetchConfig, createPluginManager, trustPlugins },
    ),
  ).rejects.toThrow(/1 connection\(s\)/)

  expect(createPluginManager).not.toHaveBeenCalled()
})

test("a setting Desktop's session did not take is reported on the session", async () => {
  const errors: string[] = []
  // a real node, since the check reads what MST kept: `fromTheFuture` is not
  // declared here, so the snapshot applied without it and without complaint
  const session = types
    .model({
      name: '',
      views: types.array(types.frozen()),
      useWorkspaces: false,
    })
    .actions(() => ({
      notifyError(message: string) {
        errors.push(message)
      },
    }))
    .create(snapshot)
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest
    .fn()
    .mockResolvedValue({ rootModel: { session } })

  await launchFromLink(inlineLink({ ...snapshot, fromTheFuture: 1 }), {
    fetchConfig,
    createPluginManager,
    trustPlugins,
  })

  expect(errors).toEqual([expect.stringContaining('(fromTheFuture)')])
})

test("a link with no config= means the instance's own config.json", async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  await launchFromLink(inlineLink(snapshot, 'x=1'), {
    fetchConfig,
    createPluginManager,
    trustPlugins,
  })

  expect(fetchConfig).toHaveBeenCalledWith(
    'https://jbrowse.org/code/jb2/main/config.json',
  )
})

// the deflated form, wrapped as the jbrowse:// link a web page hands the OS
test('an encoded- session in a jbrowse:// link opens the same way', async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)
  const web = `https://jbrowse.org/code/jb2/main/#config=%2Fucsc%2Fhg38%2Fconfig.json&session=encoded-${await toUrlSafeB64(JSON.stringify(snapshot))}`

  await launchFromLink(`jbrowse://open?url=${encodeURIComponent(web)}`, {
    fetchConfig,
    createPluginManager,
    trustPlugins,
  })

  expect(fetchConfig).toHaveBeenCalledWith(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(createPluginManager).toHaveBeenCalledWith({
    ...config,
    plugins: [],
    defaultSession: snapshot,
  })
})

// What JBrowse Web's share button writes by default: an id the share service
// holds the encrypted session under, and a password only the link carries.
const shareLink =
  'https://jbrowse.org/code/jb2/main/?config=%2Fucsc%2Fhg38%2Fconfig.json&session=share-abc&password=pw123'

async function stubShareService() {
  const stored = await aesEncrypt(
    await toUrlSafeB64(JSON.stringify(snapshot)),
    'pw123',
  )
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ session: stored }),
  })
  globalThis.fetch = fetchMock
  return fetchMock
}

describe('a share- link', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('is fetched from the default share service and opened', async () => {
    const fetchMock = await stubShareService()
    const fetchConfig = jest.fn().mockResolvedValue(config)
    const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

    await launchFromLink(shareLink, {
      fetchConfig,
      createPluginManager,
      trustPlugins,
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://share.jbrowse.org/api/v1/load?sessionId=abc',
    )
    expect(createPluginManager).toHaveBeenCalledWith({
      ...config,
      plugins: [],
      defaultSession: snapshot,
    })
  })

  test("uses the config's own share service, relative to the page it was shared from", async () => {
    const fetchMock = await stubShareService()
    const fetchConfig = jest
      .fn()
      .mockResolvedValue({ ...config, configuration: { shareURL: 'api/' } })
    const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

    await launchFromLink(shareLink, {
      fetchConfig,
      createPluginManager,
      trustPlugins,
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://jbrowse.org/code/jb2/main/api/load?sessionId=abc',
    )
  })

  test('that lost its password says so, and builds nothing', async () => {
    const fetchMock = await stubShareService()
    const fetchConfig = jest.fn().mockResolvedValue(config)
    const createPluginManager = jest.fn()

    await expect(
      launchFromLink(shareLink.replace('&password=pw123', ''), {
        fetchConfig,
        createPluginManager,
        trustPlugins,
      }),
    ).rejects.toThrow(/missing its "password"/)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(createPluginManager).not.toHaveBeenCalled()
  })
})
