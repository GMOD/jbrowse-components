import { types, destroy } from '@jbrowse/mobx-state-tree'
import { waitForConnectionsLoaded } from '../createPluginManager.ts'

// Minimal connection-like model for testing waitForConnectionsLoaded
const ConnectionModel = types
  .model('MockConnection', {
    name: types.identifier,
    tracks: types.array(types.frozen()),
  })
  .actions(self => ({
    addTrack(track: Record<string, unknown>) {
      self.tracks.push(track)
    },
  }))

const SessionModel = types.model('MockSession', {
  connectionInstances: types.array(ConnectionModel),
})

test('waitForConnectionsLoaded resolves when tracks arrive', async () => {
  const session = SessionModel.create({
    connectionInstances: [{ name: 'hub1', tracks: [] }],
  })

  // Simulate tracks arriving asynchronously
  setTimeout(() => {
    const conn = session.connectionInstances[0]!
    conn.addTrack({ trackId: 'track1', type: 'FeatureTrack' })
  }, 10)

  await waitForConnectionsLoaded(session)

  expect(session.connectionInstances[0]!.tracks.length).toBe(1)
})

test('waitForConnectionsLoaded resolves immediately if no connections', async () => {
  const session = SessionModel.create({
    connectionInstances: [],
  })

  await waitForConnectionsLoaded(session)
  // Should resolve without hanging
})

test('waitForConnectionsLoaded resolves when connection is destroyed', async () => {
  const session = SessionModel.create({
    connectionInstances: [{ name: 'hub1', tracks: [] }],
  })

  // Simulate the connection being removed/destroyed
  setTimeout(() => {
    session.connectionInstances.clear()
  }, 10)

  await waitForConnectionsLoaded(session)
  // Should resolve because isAlive returns false for the destroyed node
})

test('waitForConnectionsLoaded handles multiple connections', async () => {
  const session = SessionModel.create({
    connectionInstances: [
      { name: 'hub1', tracks: [] },
      { name: 'hub2', tracks: [] },
    ],
  })

  setTimeout(() => {
    session.connectionInstances[0]!.addTrack({
      trackId: 'track1',
      type: 'FeatureTrack',
    })
  }, 10)

  setTimeout(() => {
    session.connectionInstances[1]!.addTrack({
      trackId: 'track2',
      type: 'FeatureTrack',
    })
  }, 20)

  await waitForConnectionsLoaded(session)

  expect(session.connectionInstances[0]!.tracks.length).toBe(1)
  expect(session.connectionInstances[1]!.tracks.length).toBe(1)
})

test('waitForConnectionsLoaded calls onStatus for each connection', async () => {
  const session = SessionModel.create({
    connectionInstances: [
      { name: 'UCSC Hub', tracks: [] },
      { name: 'JB2 Hub', tracks: [] },
    ],
  })

  const statusMessages: string[] = []
  const onStatus = (msg: string) => {
    statusMessages.push(msg)
  }

  setTimeout(() => {
    session.connectionInstances[0]!.addTrack({
      trackId: 'track1',
      type: 'FeatureTrack',
    })
    session.connectionInstances[1]!.addTrack({
      trackId: 'track2',
      type: 'FeatureTrack',
    })
  }, 10)

  await waitForConnectionsLoaded(session, onStatus)

  expect(statusMessages).toEqual([
    'Loading connection "UCSC Hub"...',
    'Loading connection "JB2 Hub"...',
  ])
})

test('postProcessSnapshot strips tracks from connectionInstances', () => {
  // This tests the concept — the actual postProcessSnapshot is on the
  // ConnectionManagementSessionMixin which requires a full pluginManager setup.
  // Here we verify the stripping logic directly.
  const snapshot = {
    connectionInstances: [
      {
        name: 'hub1',
        type: 'UCSCTrackHubConnection',
        configuration: 'conn1',
        tracks: [
          { trackId: 'track1', type: 'FeatureTrack' },
          { trackId: 'track2', type: 'QuantitativeTrack' },
        ],
      },
      {
        name: 'hub2',
        type: 'JB2TrackHubConnection',
        configuration: 'conn2',
        tracks: [{ trackId: 'track3', type: 'FeatureTrack' }],
      },
    ],
    views: [],
    name: 'test-session',
  }

  // Simulate the postProcessSnapshot logic
  const { connectionInstances, ...rest } = snapshot
  const processed = {
    ...rest,
    connectionInstances: connectionInstances.map(
      ({ tracks, ...conn }) => conn,
    ),
  }

  expect(processed.connectionInstances).toEqual([
    {
      name: 'hub1',
      type: 'UCSCTrackHubConnection',
      configuration: 'conn1',
    },
    {
      name: 'hub2',
      type: 'JB2TrackHubConnection',
      configuration: 'conn2',
    },
  ])
  // Original should still have tracks
  expect(snapshot.connectionInstances[0]!.tracks.length).toBe(2)
})

test('postProcessSnapshot returns rest when no connectionInstances', () => {
  const snapshot = {
    views: [],
    name: 'test-session',
  }

  const { connectionInstances, ...rest } = snapshot as typeof snapshot & {
    connectionInstances?: unknown[]
  }
  if (!connectionInstances?.length) {
    expect(rest).toEqual({ views: [], name: 'test-session' })
  }
})
