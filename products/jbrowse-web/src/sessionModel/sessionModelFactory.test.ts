import PluginManager from '@jbrowse/core/PluginManager'
import {
  getNumberGrouping,
  setNumberGrouping,
  toLocale,
} from '@jbrowse/core/util'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import { createTestSession } from '../rootModel/test_util.ts'
import sessionModelFactory from './index.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('../makeWorkerInstance', () => () => {})

/**
 * Rewrites the workspace layout's panel and tab ids to `panel-1`, `tab-1`, ...
 * in first-seen order, so a session snapshot can be compared at all: those ids
 * are random per session by design (WorkspaceLayout's `nextId`, which explains
 * why a counter would collide with a restored snapshot).
 *
 * Same id in, same placeholder out — which keeps the one cross-reference in
 * there worth checking, `activeTabId` naming a tab that is in `tabs`. A blanket
 * `expect.any(String)` matcher per id would drop it.
 *
 * Walks rather than round-tripping through JSON: a key whose value is
 * `undefined` is part of what is being asserted here, and `JSON.stringify`
 * deletes it.
 */
function withStableLayoutIds(value: unknown, seen = new Map<string, string>()) {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(walk)
    }
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node).map(([key, val]) => [key, walk(val)]),
      )
    }
    if (typeof node === 'string') {
      const kind = /^(panel|tab)-/.exec(node)?.[1]
      if (kind) {
        const known = seen.get(node)
        if (known) {
          return known
        }
        const same = [...seen.values()].filter(v => v.startsWith(kind))
        const placeholder = `${kind}-${same.length + 1}`
        seen.set(node, placeholder)
        return placeholder
      }
    }
    return node
  }
  return walk(value)
}

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
    expect(withStableLayoutIds(rest)).toMatchSnapshot()
  })

  it('accepts a custom drawer width', () => {
    const session = createTestSession({ sessionSnapshot: { drawerWidth: 256 } })
    expect(session.drawerWidth).toBe(256)
  })

  describe('connections', () => {
    // the connection arrays are typed by a pluggable schema, so their elements
    // land as `any`; name the element type once here rather than per assertion
    const ids = (confs: AnyConfigurationModel[]) =>
      confs.map(c => c.connectionId as string)
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

    // the two adders differ in where the config lands, which is the whole
    // reason both exist: addConnectionConf follows the user (an admin's edits
    // are the site's), addSessionConnectionConf always means this session
    it.each([false, true])(
      'addSessionConnectionConf keeps the config in the session (adminMode=%s)',
      adminMode => {
        const session = createTestSession({ adminMode })
        session.addSessionConnectionConf(connSnap)
        expect(ids(session.sessionConnections)).toEqual(['conn1'])
        expect(session.jbrowse.connections).toHaveLength(0)
      },
    )

    it('an admin addConnectionConf writes the config, not the session', () => {
      const session = createTestSession({ adminMode: true })
      session.addConnectionConf(connSnap)
      expect(session.sessionConnections).toHaveLength(0)
      expect(ids(session.jbrowse.connections)).toEqual(['conn1'])
    })

    it('a non-admin addConnectionConf writes the session, not the config', () => {
      const session = createTestSession({})
      session.addConnectionConf(connSnap)
      expect(ids(session.sessionConnections)).toEqual(['conn1'])
      expect(session.jbrowse.connections).toHaveLength(0)
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

  // the same session-vs-config split as the two connection adders above, and
  // for the same reason: a caller that means "this session" must be able to say
  // so rather than inheriting whoever happens to be looking
  describe('track adders', () => {
    const trackSnap = {
      trackId: 'spec_track',
      type: 'FeatureTrack',
      name: 'spec track',
      assemblyNames: ['volvox'],
      adapter: { type: 'FromConfigAdapter', features: [] },
    }

    it.each([false, true])(
      'addSessionTrackConf keeps the config in the session (adminMode=%s)',
      adminMode => {
        const session = createTestSession({ adminMode })
        session.addSessionTrackConf(trackSnap)
        expect(session.sessionTracks.map(t => t.trackId)).toEqual([
          'spec_track',
        ])
        expect(session.jbrowse.tracks).toHaveLength(0)
      },
    )

    it('an admin addTrackConf writes the config, not the session', () => {
      const session = createTestSession({ adminMode: true })
      session.addTrackConf(trackSnap)
      expect(session.sessionTracks).toHaveLength(0)
      expect(
        session.jbrowse.tracks.map((t: AnyConfigurationModel) => t.trackId),
      ).toEqual(['spec_track'])
    })

    it('a non-admin addTrackConf writes the session, not the config', () => {
      const session = createTestSession({})
      session.addTrackConf(trackSnap)
      expect(session.sessionTracks.map(t => t.trackId)).toEqual(['spec_track'])
      expect(session.jbrowse.tracks).toHaveLength(0)
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

    // The Preferences "Display defaults" section asks the session for the
    // inventory rather than filtering `getPreferenceChanges` on a path head,
    // precisely so the composite-key layout stays this model's business.
    it('lists every promoted default, and drops one when it is cleared', () => {
      const session = createTestSession()
      expect(session.getDisplayTypeDefaults()).toEqual([])

      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault('LinearArcDisplay', 'displayMode', 'arcs')
      // a scalar preference sharing the store is not a display-type default
      session.setScrollZoom(true)
      expect(session.getDisplayTypeDefaults()).toEqual([
        {
          displayType: 'LinearBasicDisplay',
          slot: 'displayMode',
          value: 'compact',
        },
        { displayType: 'LinearArcDisplay', slot: 'displayMode', value: 'arcs' },
      ])

      session.setDisplayTypeDefault(
        'LinearArcDisplay',
        'displayMode',
        undefined,
      )
      expect(session.getDisplayTypeDefaults()).toEqual([
        {
          displayType: 'LinearBasicDisplay',
          slot: 'displayMode',
          value: 'compact',
        },
      ])
    })

    it('freezes an object-valued promoted default, which is shared by reference', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'colorBy', {
        type: 'tag',
        tag: 'HP',
      })
      // `deep: false` hands this straight back out to every display following
      // it, so an in-place edit would rewrite what all of them read
      const promoted: unknown = session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'colorBy',
      )
      expect(promoted).toEqual({ type: 'tag', tag: 'HP' })
      expect(() => {
        if (typeof promoted === 'object' && promoted !== null) {
          Object.assign(promoted, { tag: 'XT' })
        }
      }).toThrow(TypeError)
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
        () =>
          session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
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
      // survive JSON.stringify (escaped as \u0000) / JSON.parse intact
      const raw = localStorage.getItem('jbrowsePreferences')
      expect(raw).toContain('\\u0000')

      // a fresh session (simulating a reload) rehydrates the promoted default
      const reloaded = createTestSession()
      expect(
        reloaded.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
    })
  })

  describe('themeName persistence', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    // The stored value is the user's raw selection, not the `themeName` getter,
    // which coerces a currently-unregistered name to 'default'.
    //
    // Regression: the web session ran a second autorun writing the *coerced*
    // value to the same key. Loading a session whose stored theme came from a
    // plugin that isn't present overwrote the selection with 'default' at
    // attach, so it could never resolve again once that plugin came back. The
    // clobber only shows up on this path — after load the coerced value is a
    // computed that doesn't change, so its autorun never re-fires.
    it('keeps a stored theme from an absent plugin instead of coercing it away', () => {
      localStorage.setItem('themeName', 'someThemeFromAPlugin')

      // reload with the theme's plugin missing: renders with the fallback...
      const session = createTestSession()
      expect(session.themeName).toBe('default')
      // ...but the selection itself is still on disk
      expect(localStorage.getItem('themeName')).toBe('someThemeFromAPlugin')

      // so once the plugin providing it is present again, it resolves
      const withPlugin = createTestSession({
        jbrowseConfig: {
          configuration: {
            extraThemes: { someThemeFromAPlugin: { name: 'From a plugin' } },
          },
        },
      })
      expect(withPlugin.themeName).toBe('someThemeFromAPlugin')
    })
  })

  describe('numberGrouping applies to the formatter', () => {
    // BaseSession's afterAttach pushes the config default into the module-level
    // formatter, PreferencesSessionMixin's re-applies it after loading stored
    // overrides. MST composes lifecycle hooks rather than overriding them, and
    // that ordering is what makes a user override beat the admin default —
    // assert it rather than trusting the hook order.
    beforeEach(() => {
      localStorage.clear()
      setNumberGrouping(true)
    })
    afterAll(() => {
      setNumberGrouping(true)
    })

    it('defaults to grouped', () => {
      createTestSession()
      expect(getNumberGrouping()).toBe(true)
      expect(toLocale(1234567)).toBe('1,234,567')
    })

    it('a stored user override wins over the config default on reload', () => {
      const session = createTestSession()
      session.setPreferenceOverride('numberGrouping', false)

      // a fresh session (simulating the reload the preference asks for)
      setNumberGrouping(true)
      createTestSession()
      expect(getNumberGrouping()).toBe(false)
      expect(toLocale(1234567)).toBe('1234567')
    })
  })

  describe('scroll-to-zoom hint budget', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('starts with a budget and spends it a raise at a time', () => {
      const session = createTestSession()
      expect(session.canShowScrollZoomHint).toBe(true)
      session.setScrollZoomHintCount(session.scrollZoomHintCount + 1)
      expect(session.canShowScrollZoomHint).toBe(true)
    })

    it('setting the preference ends it, from wherever it was set', () => {
      // the view menu, the Preferences dialog and the prompt's own button all
      // land here, and all of them mean the same thing: they found the setting
      const session = createTestSession()
      session.setScrollZoom(true)
      expect(session.canShowScrollZoomHint).toBe(false)
    })

    it('turning it back off ends it too', () => {
      // the one user who most obviously does not need to be told again
      const session = createTestSession()
      session.setScrollZoom(false)
      expect(session.canShowScrollZoomHint).toBe(false)
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

  // The Preferences dialog's per-row revert hands a row's `path` straight back,
  // so each shape getPreferenceChanges emits has to round-trip. A promoted
  // default is the one that can silently no-op: its path is a readable label
  // over a flat composite storage key, not the key itself.
  describe('resetPreferenceChange (per-row revert)', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('reverts a promoted per-display-type default by its row path', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      const [change] = session.getPreferenceChanges()
      session.resetPreferenceChange(change!.path)
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()
      expect(session.getPreferenceChanges()).toEqual([])
    })

    it('leaves a sibling display type alone', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'featureHeight',
        3,
      )
      session.resetPreferenceChange([
        'displayTypeDefaults',
        'LinearBasicDisplay',
        'displayMode',
      ])
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'featureHeight',
        ),
      ).toBe(3)
    })

    it('reverts a scalar override, whose path is its own key', () => {
      const session = createTestSession()
      session.setScrollZoom(true)
      session.resetPreferenceChange(['scrollZoom'])
      expect(session.getPreferenceChanges()).toEqual([])
    })
  })
})
