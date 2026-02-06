import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import { preLoadConnectionTracks } from '../createPluginManager.ts'
import JBrowseRootModelFactory from '../rootModel/rootModel.ts'
import sessionModelFactory from '../sessionModel/index.ts'

jest.mock('../makeWorkerInstance', () => () => {})

function setupRootModel(jbrowseConfig: Record<string, unknown> = {}) {
  const pluginManager = new PluginManager(
    corePlugins.map(P => new P()),
  ).createPluggableElements()

  const rootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: false,
  }).create(
    {
      jbrowse: {
        ...jbrowseConfig,
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
        },
      },
    },
    { pluginManager },
  )

  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return { pluginManager, rootModel }
}

describe('postProcessSnapshot strips connection tracks', () => {
  it('strips tracks from connectionInstances in session snapshot', () => {
    const { rootModel } = setupRootModel({
      connections: [
        {
          type: 'JB2TrackHubConnection',
          connectionId: 'conn1',
          name: 'testConn',
          assemblyNames: ['volvox'],
          configJsonLocation: {
            uri: 'http://example.com/config.json',
            locationType: 'UriLocation',
          },
        },
      ],
    })

    rootModel.setSession({
      name: 'testSession',
      connectionInstances: [
        {
          type: 'JB2TrackHubConnection',
          name: 'testConn',
          configuration: 'conn1',
          tracks: [
            {
              type: 'FeatureTrack',
              trackId: 'track1',
              name: 'Track 1',
              assemblyNames: ['volvox'],
              adapter: {
                type: 'BigBedAdapter',
                bigBedLocation: { uri: 'test.bb' },
              },
            },
          ],
        },
      ],
    })

    const session = rootModel.session!
    const snap = getSnapshot(session) as Record<string, unknown>

    const connInstances = snap.connectionInstances as Record<string, unknown>[]
    expect(connInstances).toBeDefined()
    expect(connInstances.length).toBe(1)

    // tracks should be stripped out by postProcessSnapshot
    expect(connInstances[0]!.tracks).toBeUndefined()

    // other properties should still be there
    expect(connInstances[0]!.name).toBe('testConn')
    expect(connInstances[0]!.type).toBe('JB2TrackHubConnection')
  })

  it('returns snapshot without connectionInstances key when array is empty', () => {
    const { rootModel } = setupRootModel()

    rootModel.setSession({
      name: 'testSession',
    })

    const session = rootModel.session!
    const snap = getSnapshot(session) as Record<string, unknown>

    expect(snap.connectionInstances).toBeUndefined()
  })
})

describe('preLoadConnectionTracks', () => {
  it('returns snapshot unchanged when no connectionInstances', async () => {
    const { pluginManager } = setupRootModel()
    const sessionSnapshot = { name: 'testSession' }
    const configSnapshot = {}

    const result = await preLoadConnectionTracks(
      sessionSnapshot,
      configSnapshot,
      pluginManager,
    )

    expect(result).toBe(sessionSnapshot)
  })

  it('returns snapshot unchanged when connectionInstances is empty', async () => {
    const { pluginManager } = setupRootModel()
    const sessionSnapshot = {
      name: 'testSession',
      connectionInstances: [],
    }
    const configSnapshot = {}

    const result = await preLoadConnectionTracks(
      sessionSnapshot,
      configSnapshot,
      pluginManager,
    )

    expect(result).toBe(sessionSnapshot)
  })

  it('calls fetchTracks and injects tracks into connection instance', async () => {
    const { pluginManager } = setupRootModel()

    const mockTracks = [
      {
        type: 'FeatureTrack',
        trackId: 'fetched-track1',
        name: 'Fetched Track',
        assemblyNames: ['volvox'],
        adapter: { type: 'BigBedAdapter', bigBedLocation: { uri: 'test.bb' } },
      },
    ]

    const connType = pluginManager.getConnectionType('JB2TrackHubConnection')!
    const originalFetchTracks = connType.fetchTracks
    connType.fetchTracks = jest.fn().mockResolvedValue(mockTracks)

    const sessionSnapshot = {
      name: 'testSession',
      connectionInstances: [
        {
          type: 'JB2TrackHubConnection',
          name: 'testConn',
          configuration: 'conn1',
        },
      ],
    }
    const configSnapshot = {
      connections: [
        {
          type: 'JB2TrackHubConnection',
          connectionId: 'conn1',
          name: 'testConn',
          configJsonLocation: {
            uri: 'http://example.com/config.json',
            locationType: 'UriLocation',
          },
        },
      ],
    }

    const result = await preLoadConnectionTracks(
      sessionSnapshot,
      configSnapshot,
      pluginManager,
    )

    expect(connType.fetchTracks).toHaveBeenCalledWith(
      configSnapshot.connections[0],
    )
    const resultInstances = result.connectionInstances as Record<
      string,
      unknown
    >[]
    expect(resultInstances[0]!.tracks).toEqual(mockTracks)
    expect(resultInstances[0]!.name).toBe('testConn')

    connType.fetchTracks = originalFetchTracks
  })

  it('handles fetchTracks failure gracefully', async () => {
    const { pluginManager } = setupRootModel()

    const connType = pluginManager.getConnectionType('JB2TrackHubConnection')!
    const originalFetchTracks = connType.fetchTracks
    connType.fetchTracks = jest
      .fn()
      .mockRejectedValue(new Error('Network error'))

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    const sessionSnapshot = {
      name: 'testSession',
      connectionInstances: [
        {
          type: 'JB2TrackHubConnection',
          name: 'testConn',
          configuration: 'conn1',
        },
      ],
    }
    const configSnapshot = {
      connections: [
        {
          type: 'JB2TrackHubConnection',
          connectionId: 'conn1',
          name: 'testConn',
          configJsonLocation: {
            uri: 'http://example.com/config.json',
            locationType: 'UriLocation',
          },
        },
      ],
    }

    const result = await preLoadConnectionTracks(
      sessionSnapshot,
      configSnapshot,
      pluginManager,
    )

    // Should return the connection instance without tracks (graceful failure)
    const resultInstances = result.connectionInstances as Record<
      string,
      unknown
    >[]
    expect(resultInstances[0]!.tracks).toBeUndefined()
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
    connType.fetchTracks = originalFetchTracks
  })

  it('skips connection instance when config is not found', async () => {
    const { pluginManager } = setupRootModel()

    const sessionSnapshot = {
      name: 'testSession',
      connectionInstances: [
        {
          type: 'JB2TrackHubConnection',
          name: 'testConn',
          configuration: 'nonExistentConnId',
        },
      ],
    }
    const configSnapshot = {
      connections: [],
    }

    const result = await preLoadConnectionTracks(
      sessionSnapshot,
      configSnapshot,
      pluginManager,
    )

    const resultInstances = result.connectionInstances as Record<
      string,
      unknown
    >[]
    expect(resultInstances[0]!.tracks).toBeUndefined()
    expect(resultInstances[0]!.name).toBe('testConn')
  })

  it('looks up connection config from sessionConnections', async () => {
    const { pluginManager } = setupRootModel()

    const mockTracks = [{ type: 'FeatureTrack', trackId: 'tr1' }]
    const connType = pluginManager.getConnectionType('JB2TrackHubConnection')!
    const originalFetchTracks = connType.fetchTracks
    connType.fetchTracks = jest.fn().mockResolvedValue(mockTracks)

    const sessionSnapshot = {
      name: 'testSession',
      connectionInstances: [
        {
          type: 'JB2TrackHubConnection',
          name: 'sessionConn',
          configuration: 'sessConn1',
        },
      ],
      sessionConnections: [
        {
          type: 'JB2TrackHubConnection',
          connectionId: 'sessConn1',
          name: 'sessionConn',
          configJsonLocation: {
            uri: 'http://example.com/session-config.json',
            locationType: 'UriLocation',
          },
        },
      ],
    }
    const configSnapshot = {}

    const result = await preLoadConnectionTracks(
      sessionSnapshot,
      configSnapshot,
      pluginManager,
    )

    expect(connType.fetchTracks).toHaveBeenCalled()
    const resultInstances = result.connectionInstances as Record<
      string,
      unknown
    >[]
    expect(resultInstances[0]!.tracks).toEqual(mockTracks)

    connType.fetchTracks = originalFetchTracks
  })
})
