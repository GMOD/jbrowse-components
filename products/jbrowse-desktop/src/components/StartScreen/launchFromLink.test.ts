import { aesEncrypt, toUrlSafeB64 } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import { launchFromLink, launchFromPlan } from './launchFromLink.ts'

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

describe('a command-line plan', () => {
  const bam = {
    trackId: 'reads.bam',
    type: 'AlignmentsTrack',
    adapter: { type: 'BamAdapter' },
  }
  const deps = () => ({
    fetchConfig: jest.fn().mockResolvedValue(config),
    readConfigFile: jest.fn().mockResolvedValue(config),
    createPluginManager: jest.fn().mockResolvedValue(pluginManager),
  })

  test('with its own genome needs no config', async () => {
    const d = deps()
    const assembly = { name: 'ref.fa', sequence: {} }
    await launchFromPlan(
      {
        type: 'LinearGenomeView',
        assembly,
        assemblyName: 'ref.fa',
        loc: 'ctgA:1-100',
        tracks: [{ ...bam, assemblyNames: ['ref.fa'] }],
        view: {},
        show: [{ trackId: 'reads.bam', modifiers: [] }],
        unapplied: [],
      },
      d,
    )
    expect(d.fetchConfig).not.toHaveBeenCalled()
    expect(d.createPluginManager).toHaveBeenCalledWith(undefined)
    expect(mockLoadSessionSpec).toHaveBeenCalledWith(
      {
        sessionAssemblies: [assembly],
        sessionTracks: [{ ...bam, assemblyNames: ['ref.fa'] }],
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'ref.fa',
            loc: 'ctgA:1-100',
            tracks: [{ trackId: 'reads.bam', modifiers: [] }],
          },
        ],
      },
      pluginManager,
    )
  })

  test('on a hosted genome, fetches it and puts the files on its assembly', async () => {
    const hosted = {
      ...config,
      tracks: [{ trackId: 'volvox-genes', name: 'Genes' }],
    }
    const d = {
      ...deps(),
      fetchConfig: jest.fn().mockResolvedValue(hosted),
    }
    await launchFromPlan(
      {
        type: 'LinearGenomeView',
        config: 'https://jbrowse.org/ucsc/hg38/config.json',
        tracks: [bam],
        view: {},
        show: [
          { trackId: 'reads.bam', modifiers: ['height:200', 'sort:base'] },
          // jb2export's --track shorthand: the assembly prefix left off
          { trackId: 'genes', modifiers: ['color.field=type', 'arcs:up'] },
          { trackId: 'genes', modifiers: ['height:80'] },
        ],
        unapplied: [],
      },
      d,
    )
    expect(d.fetchConfig).toHaveBeenCalledWith(
      'https://jbrowse.org/ucsc/hg38/config.json',
    )
    expect(d.createPluginManager).toHaveBeenCalledWith(hosted)
    // the view applies the modifiers in its own launch, once it has navigated
    expect(mockLoadSessionSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionTracks: [{ ...bam, assemblyNames: ['volvox'] }],
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            tracks: [
              { trackId: 'reads.bam', modifiers: ['height:200', 'sort:base'] },
              {
                trackId: 'volvox-genes',
                modifiers: ['color.field=type', 'arcs:up'],
              },
              { trackId: 'volvox-genes', modifiers: ['height:80'] },
            ],
          },
        ],
      }),
      pluginManager,
    )
  })

  test('a --track the config lacks fails with near matches', async () => {
    await expect(
      launchFromPlan(
        {
          type: 'LinearGenomeView',
          config: '/proj/config.json',
          tracks: [],
          view: {},
          show: [{ trackId: 'nope', modifiers: [] }],
          unapplied: [],
        },
        deps(),
      ),
    ).rejects.toThrow('--track "nope" not found in the config')
  })

  test('reads a local config from disk, not over the network', async () => {
    const d = deps()
    await launchFromPlan(
      {
        type: 'LinearGenomeView',
        config: '/proj/config.json',
        view: {},
        tracks: [],
        show: [],
        unapplied: [],
      },
      d,
    )
    expect(d.readConfigFile).toHaveBeenCalledWith('/proj/config.json')
    expect(d.fetchConfig).not.toHaveBeenCalled()
  })

  test('--view settings go on the view', async () => {
    const d = deps()
    await launchFromPlan(
      {
        type: 'LinearGenomeView',
        assembly: { name: 'ref.fa', sequence: {} },
        assemblyName: 'ref.fa',
        view: { axis: { grid: false } },
        tracks: [],
        show: [],
        unapplied: [],
      },
      d,
    )
    expect(mockLoadSessionSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'ref.fa',
            axis: { grid: false },
            tracks: [],
          },
        ],
      }),
      pluginManager,
    )
  })

  test('an --assembly the config lacks names the ones it has', async () => {
    await expect(
      launchFromPlan(
        {
          type: 'LinearGenomeView',
          config: '/proj/config.json',
          assemblyName: 'asm.json',
          view: {},
          tracks: [],
          show: [],
          unapplied: [],
        },
        deps(),
      ),
    ).rejects.toThrow(
      '/proj/config.json has no assembly asm.json; it has volvox',
    )
  })

  test("an --assembly alias opens as the config's own name", async () => {
    const aliased = {
      ...config,
      assemblies: [{ name: 'hg38', aliases: ['GRCh38'] }],
      tracks: [{ trackId: 'hg38-ncbiRefSeq', name: 'RefSeq' }],
    }
    const d = {
      ...deps(),
      readConfigFile: jest.fn().mockResolvedValue(aliased),
    }
    await launchFromPlan(
      {
        type: 'LinearGenomeView',
        config: '/proj/config.json',
        assemblyName: 'GRCh38',
        view: {},
        tracks: [bam],
        show: [{ trackId: 'ncbiRefSeq', modifiers: [] }],
        unapplied: [],
      },
      d,
    )
    expect(mockLoadSessionSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionTracks: [{ ...bam, assemblyNames: ['hg38'] }],
        views: [
          expect.objectContaining({
            assembly: 'hg38',
            tracks: [{ trackId: 'hg38-ncbiRefSeq', modifiers: [] }],
          }),
        ],
      }),
      pluginManager,
    )
  })

  test('a config track the loose way, with no trackId, is skipped by --track', async () => {
    const loose = {
      ...config,
      tracks: [{ uri: 'genes.gff3.gz' }, { trackId: 'volvox-genes' }],
    } as unknown as typeof config
    const d = { ...deps(), readConfigFile: jest.fn().mockResolvedValue(loose) }
    await launchFromPlan(
      {
        type: 'LinearGenomeView',
        config: '/proj/config.json',
        view: {},
        tracks: [],
        show: [{ trackId: 'genes', modifiers: [] }],
        unapplied: [],
      },
      d,
    )
    expect(mockLoadSessionSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        views: [
          expect.objectContaining({
            tracks: [{ trackId: 'volvox-genes', modifiers: [] }],
          }),
        ],
      }),
      pluginManager,
    )
  })

  test('a synteny plan opens one view of its genome rows', async () => {
    const d = deps()
    const assemblies = [
      { name: 'a.fa', sequence: {} },
      { name: 'b.fa', sequence: {} },
    ]
    const paf = {
      trackId: 'a_b.paf',
      type: 'SyntenyTrack',
      assemblyNames: ['a.fa', 'b.fa'],
    }
    await launchFromPlan(
      {
        type: 'LinearSyntenyView',
        assemblies,
        views: [{ assembly: 'a.fa', loc: 'chr1' }, { assembly: 'b.fa' }],
        view: { mark: { interpolate: 'bump' } },
        tracks: [paf],
        unapplied: [],
      },
      d,
    )
    expect(d.fetchConfig).not.toHaveBeenCalled()
    expect(d.createPluginManager).toHaveBeenCalledWith(undefined)
    expect(mockLoadSessionSpec).toHaveBeenCalledWith(
      {
        sessionAssemblies: assemblies,
        sessionTracks: [paf],
        views: [
          {
            type: 'LinearSyntenyView',
            mark: { interpolate: 'bump' },
            views: [{ assembly: 'a.fa', loc: 'chr1' }, { assembly: 'b.fa' }],
            tracks: ['a_b.paf'],
          },
        ],
      },
      pluginManager,
    )
  })

  test('names the settings it did not apply', async () => {
    const notify = jest.fn()
    const d = {
      ...deps(),
      createPluginManager: jest
        .fn()
        .mockResolvedValue({ rootModel: { session: { notify } } }),
    }
    await launchFromPlan(
      {
        type: 'LinearGenomeView',
        assembly: { name: 'ref.fa', sequence: {} },
        assemblyName: 'ref.fa',
        tracks: [],
        view: {},
        show: [],
        unapplied: ['--opacity 0.3'],
      },
      d,
    )
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('--opacity 0.3'),
      'warning',
    )
  })
})
