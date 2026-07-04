import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import sessionModelFactory from './index.ts'
import { createTestSession } from '../rootModel/index.ts'
jest.mock('../makeWorkerInstance', () => () => {})

describe('JBrowseWebSessionModel', () => {
  it('creates with no parent and just a name', () => {
    const pluginManager = new PluginManager()
    pluginManager.configure()
    const sessionModel = sessionModelFactory({
      pluginManager,
      // @ts-expect-error
      assemblyConfigSchema: types.frozen(),
    })
    const session = sessionModel.create(
      { name: 'testSession' },
      { pluginManager },
    )

    const { id, ...rest } = getSnapshot(session)
    expect(rest).toMatchSnapshot()
  })

  it('accepts a custom drawer width', () => {
    const session = createTestSession({ sessionSnapshot: { drawerWidth: 256 } })
    expect(session.drawerWidth).toBe(256)
  })

  describe('connections', () => {
    const connSnap = {
      type: 'UCSCTrackHubConnection',
      connectionId: 'conn1',
      name: 'conn1',
      hubTxtLocation: { uri: 'http://example.com/hub.txt' },
    }

    it('lists session connections in the connections getter', () => {
      const session = createTestSession({
        sessionSnapshot: { sessionConnections: [connSnap] },
      })
      expect(session.connections.map(c => c.connectionId)).toEqual(['conn1'])
    })

    it('non-admin can delete a session connection', () => {
      const session = createTestSession({
        sessionSnapshot: { sessionConnections: [connSnap] },
      })
      session.deleteConnection(session.sessionConnections[0])
      expect(session.sessionConnections).toHaveLength(0)
    })

    it('admin can delete a session connection carried by the session', () => {
      // an admin may view a shared/hub session that carries sessionConnections;
      // deleteConnection must still remove them rather than only searching the
      // jbrowse config-level connections
      const session = createTestSession({
        adminMode: true,
        sessionSnapshot: { sessionConnections: [connSnap] },
      })
      session.deleteConnection(session.sessionConnections[0])
      expect(session.sessionConnections).toHaveLength(0)
    })

    it('admin deleteConnection removes the requested config connection, not the first', () => {
      // regression: connection configs use explicitIdentifier connectionId, so
      // `.id` is undefined; an id-based find in deleteConnectionConf always hit
      // the first entry and deleted the wrong connection
      const session = createTestSession({
        adminMode: true,
        jbrowseConfig: {
          connections: [
            { ...connSnap, connectionId: 'connA', name: 'A' },
            { ...connSnap, connectionId: 'connB', name: 'B' },
          ],
        },
      })
      const connB = session.connections.find(c => c.connectionId === 'connB')!
      session.deleteConnection(connB)
      expect(session.connections.map(c => c.connectionId)).toEqual(['connA'])
    })

    it('non-admin addConnectionConf dedupes an already-present connection', () => {
      const session = createTestSession({
        sessionSnapshot: { sessionConnections: [connSnap] },
      })
      const existing = session.sessionConnections[0]!
      const result = session.addConnectionConf(existing)
      expect(session.sessionConnections).toHaveLength(1)
      expect(result).toBe(existing)
    })
  })

  describe('displayTypeDefaults store', () => {
    it('round-trips a promoted per-display-type slot default', () => {
      const session = createTestSession()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()

      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
    })

    it('keeps defaults for different display types independent', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault('LinearArcDisplay', 'displayMode', 'arcs')
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
      expect(
        session.getDisplayTypeDefault('LinearArcDisplay', 'displayMode'),
      ).toBe('arcs')
    })

    it('clears a default when set to undefined without disturbing siblings', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault('LinearBasicDisplay', 'height', 20)

      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        undefined,
      )
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'height'),
      ).toBe(20)
    })
  })
})
