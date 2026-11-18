import Plugin from '@jbrowse/core/Plugin'

import { createPluginManager } from './createPluginManager.ts'

import type { SessionSource } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('./makeWorkerInstance', () => () => {})
jest.mock('./loadHubSpec', () => ({
  loadHubSpec: jest.fn().mockRejectedValue(new Error('hub broke')),
}))

async function sessionNameFor(
  sessionSource: SessionSource,
  sessionName?: string,
) {
  const pluginManager = await createPluginManager(
    {
      configSnapshot: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          disableAnalytics: true,
        },
      },
      sessionSource,
      sessionName,
      initialTimestamp: 0,
    },
    () => {},
  )
  return pluginManager.rootModel!.session!.name
}

// `?extendSession=true&sessionTracks=[…]` opened the configured default
// session with the tracks dropped and no diagnostic
test('a default session gets the link’s sessionTracks', async () => {
  const pluginManager = await createPluginManager(
    {
      configSnapshot: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          disableAnalytics: true,
        },
        defaultSession: { name: 'Curated' },
      },
      sessionSource: { type: 'default' },
      defaultSessionTracks: [
        {
          trackId: 'url_track',
          type: 'FeatureTrack',
          name: 'URL track',
          assemblyNames: ['volvox'],
          adapter: { type: 'FromConfigAdapter', features: [] },
        },
      ],
      initialTimestamp: 0,
    },
    () => {},
  )
  const session = pluginManager.rootModel!.session as unknown as {
    sessionTracks: { trackId: string }[]
  }
  expect(session.sessionTracks.map(t => t.trackId)).toEqual(['url_track'])
})

test('a hub that fails to set up falls back to a session that says so', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  const pluginManager = await createPluginManager(
    {
      configSnapshot: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          disableAnalytics: true,
        },
      },
      sessionSource: {
        type: 'hub',
        hubSpec: { hubURL: ['https://example.com/hub.txt'] },
      },
      initialTimestamp: 0,
    },
    () => {},
  )
  const session = pluginManager.rootModel!.session as unknown as {
    snackbarMessages: { message: string }[]
  }
  expect(session.snackbarMessages.map(m => m.message)).toEqual([
    'Error: hub broke',
  ])
  expect(error).toHaveBeenCalledWith(new Error('hub broke'))
  error.mockRestore()
})

test('a runtime plugin whose install() throws is reported on the session', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  class V4Plugin extends Plugin {
    name = 'V4Plugin'
    install(pluginManager: PluginManager) {
      pluginManager.addRendererType(() => ({}))
    }
  }
  const pluginManager = await createPluginManager(
    {
      configSnapshot: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          disableAnalytics: true,
        },
      },
      runtimePlugins: [
        {
          plugin: V4Plugin,
          definition: { name: 'V4', url: 'https://example.com/v4.js' },
        },
      ],
      initialTimestamp: 0,
    },
    () => {},
  )
  const session = pluginManager.rootModel!.session as unknown as {
    snackbarMessages: { message: string }[]
  }
  expect(session.snackbarMessages.map(m => m.message)).toEqual([
    expect.stringMatching(/Failed to load plugin V4/),
  ])
  expect(pluginManager.hasPlugin('V4Plugin')).toBe(false)
  error.mockRestore()
})

describe('a spec session', () => {
  const spec = { sessionName: 'From the spec', views: [] }

  test('keeps its own sessionName when the URL names none', async () => {
    expect(await sessionNameFor({ type: 'spec', spec })).toBe('From the spec')
  })

  test('takes &sessionName= over its own', async () => {
    expect(await sessionNameFor({ type: 'spec', spec }, 'From the URL')).toBe(
      'From the URL',
    )
  })
})

const volvoxAssembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [{ refName: 'ctgA', uniqueId: 'ctgA', start: 0, end: 100 }],
    },
  },
}

async function viewTypesFor(
  sessionSource: SessionSource,
  configSnapshot: Record<string, unknown>,
) {
  const pluginManager = await createPluginManager(
    {
      configSnapshot: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          disableAnalytics: true,
        },
        ...configSnapshot,
      },
      sessionSource,
      initialTimestamp: 0,
    },
    () => {},
  )
  const session = pluginManager.rootModel!.session as unknown as {
    views: { type: string }[]
  }
  return session.views.map(v => v.type)
}

describe('a new session', () => {
  test('opens a linear genome view when the config has an assembly', async () => {
    expect(
      await viewTypesFor({ type: 'default' }, { assemblies: [volvoxAssembly] }),
    ).toEqual(['LinearGenomeView'])
  })

  test('opens no view when the config has no assembly', async () => {
    expect(await viewTypesFor({ type: 'default' }, {})).toEqual([])
  })

  test('keeps the views a configured defaultSession names', async () => {
    expect(
      await viewTypesFor(
        { type: 'default' },
        {
          assemblies: [volvoxAssembly],
          defaultSession: {
            name: 'Curated',
            views: [{ type: 'SpreadsheetView' }],
          },
        },
      ),
    ).toEqual(['SpreadsheetView'])
  })

  test('a spec naming no views stays at zero views', async () => {
    expect(
      await viewTypesFor(
        { type: 'spec', spec: { views: [] } },
        { assemblies: [volvoxAssembly] },
      ),
    ).toEqual([])
  })
})
