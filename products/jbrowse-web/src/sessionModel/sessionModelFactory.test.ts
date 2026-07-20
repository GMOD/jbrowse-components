import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

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

    it('deleting a dormant connection prunes only its persisted open-track configs', () => {
      // a reloaded session restores opened connection tracks from
      // connectionTrackConfigs without re-establishing the connection (dormant,
      // no live connectionInstances entry). Deleting it must still prune those
      // configs, not leave them orphaned, and must leave other connections' be.
      const session = createTestSession({
        sessionSnapshot: {
          sessionConnections: [
            { ...connSnap, connectionId: 'conn1', name: 'conn1' },
            { ...connSnap, connectionId: 'conn2', name: 'conn2' },
          ],
          connectionTrackConfigs: {
            t1: { connectionId: 'conn1', config: { trackId: 't1' } },
            t2: { connectionId: 'conn2', config: { trackId: 't2' } },
          },
        },
      })
      const conn1 = session.connections.find(c => c.connectionId === 'conn1')!
      session.deleteConnection(conn1)
      expect(session.connectionTrackConfigs.t1).toBeUndefined()
      expect(session.connectionTrackConfigs.t2).toBeTruthy()
      expect(session.sessionConnections.map(c => c.connectionId)).toEqual([
        'conn2',
      ])
    })

    it.each([false, true])(
      'persists an edit to an opened connection track (adminMode=%s)',
      adminMode => {
        // an opened connection track lives in connectionTrackConfigs, not
        // jbrowse.tracks or sessionTracks, so its edit must route to
        // updateConnectionTrackConfig regardless of adminMode — jbrowse's
        // updateTrackConf would silently no-op (the track isn't in the config)
        const session = createTestSession({
          adminMode,
          sessionSnapshot: {
            sessionConnections: [connSnap],
            connectionTrackConfigs: {
              t1: {
                connectionId: 'conn1',
                config: { trackId: 't1', name: 'original' },
              },
            },
          },
        })
        session.updateTrackConfiguration({ trackId: 't1', name: 'edited' })
        expect(session.connectionTrackConfigs.t1!.config.name).toBe('edited')
      },
    )
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

    it('drops the display-type entry once its last slot is cleared', () => {
      const session = createTestSession()
      // start from a clean store (createTestSession reloads persisted prefs)
      session.clearPreferenceOverrides()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        undefined,
      )
      // clearing the last slot deletes its flat composite key outright, so the
      // store is left empty rather than accumulating cruft in the persisted blob
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()
      expect(session.preferencesOverrides.size).toBe(0)
    })

    it('clearPreferenceOverrides drops every promoted default at once', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault('LinearArcDisplay', 'displayMode', 'arcs')
      session.setPreferenceOverride('animationMode', 'disabled')

      session.clearPreferenceOverrides()

      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()
      expect(
        session.getDisplayTypeDefault('LinearArcDisplay', 'displayMode'),
      ).toBeUndefined()
      // a plain override falls back to its config default too
      expect(session.animationMode).toBe('enabled')
    })

    it('a reader of one preference is not invalidated by writing another', () => {
      // regression: preferencesOverrides is a per-key observable.map, so
      // toggling scrollZoom must not wake getDisplayTypeDefault (which is read
      // in a display's rpcProps -> would re-fetch every track). A single
      // spread-replaced object made every write invalidate every reader.
      const session = createTestSession()
      session.clearPreferenceOverrides()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      let fired = 0
      const dispose = reaction(
        () => session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
        () => {
          fired += 1
        },
      )

      session.setScrollZoom(true)
      session.setScrollZoom(false)
      session.setPreferenceOverride('animationMode', 'disabled')
      expect(fired).toBe(0)

      // sanity: a change to the observed key still propagates
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'normal',
      )
      expect(fired).toBe(1)
      dispose()
    })
  })

  describe('displayTypeDefaults persistence', () => {
    // PreferencesSessionMixin persists preferencesOverrides to localStorage on
    // change and reloads them in afterAttach, so isolate each test
    beforeEach(() => {
      localStorage.clear()
    })

    it('round-trips a promoted default through localStorage across a reload', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )

      // the flat composite key holds a literal NUL (`\0`) delimiter; it must
      // survive JSON.stringify (escaped as  ) / JSON.parse intact
      const raw = localStorage.getItem('jbrowsePreferences')
      expect(raw).toContain('\\u0000')

      // a fresh session (simulating a reload) rehydrates the promoted default
      const reloaded = createTestSession()
      expect(
        reloaded.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
    })

    it('migrates a legacy nested displayTypeDefaults blob to flat keys on load', () => {
      // older builds stored promoted defaults under one nested object; a session
      // that reloads such a blob must expand it to flat per-(type, slot) keys
      localStorage.setItem(
        'jbrowsePreferences',
        JSON.stringify({
          scrollZoom: true,
          displayTypeDefaults: {
            LinearBasicDisplay: { displayMode: 'compact' },
            LinearArcDisplay: { displayMode: 'arcs' },
          },
        }),
      )

      const session = createTestSession()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
      expect(
        session.getDisplayTypeDefault('LinearArcDisplay', 'displayMode'),
      ).toBe('arcs')
      // the nested key is dropped, scalar prefs are untouched
      expect(session.preferencesOverrides.get('displayTypeDefaults')).toBeUndefined()
      expect(session.scrollZoom).toBe(true)
    })
  })

  describe('getPreferenceChanges (reset-to-defaults diff)', () => {
    // PreferencesSessionMixin persists preferencesOverrides to localStorage and
    // reloads them on attach, so a prior test's overrides would otherwise leak
    // into the next session
    beforeEach(() => {
      localStorage.clear()
    })

    it('reports nothing on a fresh session', () => {
      const session = createTestSession()
      expect(session.getPreferenceChanges()).toEqual([])
    })

    it('reports a scalar override against its config default', () => {
      const session = createTestSession()
      session.setScrollZoom(true)
      expect(session.getPreferenceChanges()).toEqual([
        { path: ['scrollZoom'], from: false, to: true },
      ])
    })

    it('omits an override equal to its default (reset is a no-op)', () => {
      const session = createTestSession()
      session.setPreferenceOverride('animationMode', 'enabled')
      expect(session.getPreferenceChanges()).toEqual([])
    })

    it('reports a promoted per-display-type default with a (default) from', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      expect(session.getPreferenceChanges()).toEqual([
        {
          path: ['displayTypeDefaults', 'LinearBasicDisplay', 'displayMode'],
          from: undefined,
          to: 'compact',
        },
      ])
    })

    it('empties once cleared', () => {
      const session = createTestSession()
      session.setScrollZoom(true)
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      expect(session.getPreferenceChanges()).toHaveLength(2)
      session.clearPreferenceOverrides()
      expect(session.getPreferenceChanges()).toEqual([])
    })
  })
})
