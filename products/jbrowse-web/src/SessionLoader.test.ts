import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import SessionLoader from './SessionLoader.ts'
import {
  createSessionLoaderFromUrl,
  reloadSessionLoader,
} from './createSessionLoader.ts'
import { readSessionFromStorage } from './sessionLoaderHelpers.ts'

// Mock dependencies
jest.mock('@jbrowse/core/util/io', () => ({
  openLocation: jest.fn().mockReturnValue({
    readFile: jest.fn().mockResolvedValue('{}'),
  }),
}))

jest.mock('./sessionSharing', () => ({
  readSessionFromDynamo: jest.fn(),
}))

jest.mock('./util', () => ({
  addRelativeUris: jest.fn(),
  checkPlugins: jest.fn().mockResolvedValue(true),
  fromUrlSafeB64: jest.fn().mockResolvedValue('{"id":"test","name":"Test"}'),
  readConf: jest.fn(),
}))

jest.mock('idb', () => ({
  openDB: jest.fn(),
}))

// keep the rest of the helpers real; only stub the network plugin fetch
jest.mock('./sessionLoaderHelpers', () => ({
  ...jest.requireActual('./sessionLoaderHelpers'),
  loadPluginRecords: jest.fn().mockResolvedValue([]),
}))

jest.mock('./createPluginManager', () => ({
  createPluginManager: jest.fn(),
}))

describe('SessionLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('session type detection getters', () => {
    it('detects shared session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'share-abc123',
        initialTimestamp: Date.now(),
      })
      expect(loader.isSharedSession).toBe(true)
      expect(loader.isLocalSession).toBe(false)
      expect(loader.isEncodedSession).toBe(false)
    })

    it('detects local session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'local-abc123',
        initialTimestamp: Date.now(),
      })
      expect(loader.isLocalSession).toBe(true)
      expect(loader.isSharedSession).toBe(false)
    })

    it('detects encoded session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'encoded-abc123',
        initialTimestamp: Date.now(),
      })
      expect(loader.isEncodedSession).toBe(true)
      expect(loader.isLocalSession).toBe(false)
    })

    it('detects json session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'json-{"session":{}}',
        initialTimestamp: Date.now(),
      })
      expect(loader.isJsonSession).toBe(true)
    })

    it('detects spec session', () => {
      const loader = SessionLoader.create({
        sessionQuery: 'spec-{"views":[]}',
        initialTimestamp: Date.now(),
      })
      expect(loader.isSpecSession).toBe(true)
    })

    it('detects hub session', () => {
      const loader = SessionLoader.create({
        hubURL: ['https://example.com/hub.txt'],
        initialTimestamp: Date.now(),
      })
      expect(loader.isHubSession).toBe(true)
    })

    it('detects JB1 style session with loc', () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        initialTimestamp: Date.now(),
      })
      expect(loader.isJb1StyleSession).toBe(true)
    })

    it('detects JB1 style session with assembly', () => {
      const loader = SessionLoader.create({
        assembly: 'hg38',
        initialTimestamp: Date.now(),
      })
      expect(loader.isJb1StyleSession).toBe(true)
    })

    it('returns false for all session types when no query', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      expect(loader.isSharedSession).toBe(false)
      expect(loader.isLocalSession).toBe(false)
      expect(loader.isEncodedSession).toBe(false)
      expect(loader.isJsonSession).toBe(false)
      expect(loader.isSpecSession).toBe(false)
      expect(loader.isHubSession).toBe(false)
      expect(loader.isJb1StyleSession).toBe(false)
    })
  })

  describe('ready state getters', () => {
    it('isSessionLoaded is true when sessionSnapshot exists', () => {
      const loader = SessionLoader.create({
        sessionSnapshot: { id: 'test', name: 'Test Session' },
        initialTimestamp: Date.now(),
      })
      expect(loader.isSessionLoaded).toBe(true)
    })

    it('isSessionLoaded is true when blankSession is true', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      expect(loader.isSessionLoaded).toBe(true)
    })

    it('isSessionLoaded is true when sessionError exists', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setSessionError(new Error('test error'))
      expect(loader.isSessionLoaded).toBe(true)
    })

    it('pluginsLoaded requires runtimePlugins for blank session', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      expect(loader.pluginsLoaded).toBe(false)

      loader.setRuntimePlugins([])
      expect(loader.pluginsLoaded).toBe(true)
    })

    it('pluginsLoaded requires both runtime and session plugins for session with snapshot', () => {
      const loader = SessionLoader.create({
        sessionSnapshot: { id: 'test' },
        initialTimestamp: Date.now(),
      })
      expect(loader.pluginsLoaded).toBe(false)

      loader.setRuntimePlugins([])
      expect(loader.pluginsLoaded).toBe(false)

      loader.setSessionPlugins([])
      expect(loader.pluginsLoaded).toBe(true)
    })

    it('ready is true when session loaded, no config error, and plugins loaded', () => {
      const loader = SessionLoader.create({
        configSnapshot: { assemblies: [] },
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      loader.setRuntimePlugins([])
      expect(loader.ready).toBe(true)
    })

    it('ready is false when config error exists', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setBlankSession(true)
      loader.setRuntimePlugins([])
      loader.setConfigError(new Error('config error'))
      expect(loader.ready).toBe(false)
    })
  })

  describe('actions', () => {
    it('setSessionSnapshot updates sessionSnapshot', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const snap = { id: 'test-id', name: 'Test' }
      loader.setSessionSnapshot(snap)
      expect(loader.sessionSnapshot).toEqual(snap)
    })

    it('setBlankSession updates blankSession', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      expect(loader.blankSession).toBe(false)
      loader.setBlankSession(true)
      expect(loader.blankSession).toBe(true)
    })

    it('setConfigSnapshot updates configSnapshot', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const snap = { assemblies: [{ name: 'test' }] }
      loader.setConfigSnapshot(snap)
      expect(loader.configSnapshot).toEqual(snap)
    })

    it('setSessionError updates sessionError', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const err = new Error('test error')
      loader.setSessionError(err)
      expect(loader.sessionError).toBe(err)
    })

    it('setConfigError updates configError', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const err = new Error('config error')
      loader.setConfigError(err)
      expect(loader.configError).toBe(err)
    })
  })

  describe('sessionTracksParsed', () => {
    it('parses sessionTracks JSON', () => {
      const tracks = [{ type: 'TestTrack', trackId: 'track1' }]
      const loader = SessionLoader.create({
        sessionTracks: JSON.stringify(tracks),
        initialTimestamp: Date.now(),
      })
      expect(loader.sessionTracksParsed).toEqual(tracks)
    })

    it('returns empty array when sessionTracks is undefined', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      expect(loader.sessionTracksParsed).toEqual([])
    })
  })

  describe('decodeSessionSpec', () => {
    it('decodes spec session query', () => {
      const spec = { views: [{ type: 'LinearGenomeView' }] }
      const loader = SessionLoader.create({
        sessionQuery: `spec-${JSON.stringify(spec)}`,
        initialTimestamp: Date.now(),
      })
      loader.decodeSessionSpec()
      expect(loader.sessionSpec).toEqual(spec)
    })
  })

  describe('decodeJb1StyleSession', () => {
    it('creates sessionSpec from loc and assembly', () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        assembly: 'hg38',
        tracks: 'track1,track2',
        initialTimestamp: Date.now(),
      })
      loader.decodeJb1StyleSession()
      expect(loader.sessionSpec).toMatchObject({
        views: [
          {
            type: 'LinearGenomeView',
            loc: 'chr1:1-1000',
            assembly: 'hg38',
            tracks: ['track1', 'track2'],
          },
        ],
      })
    })
  })

  describe('decodeHubSpec', () => {
    it('creates hubSpec from hubURL', () => {
      const loader = SessionLoader.create({
        hubURL: ['https://example.com/hub.txt'],
        initialTimestamp: Date.now(),
      })
      loader.decodeHubSpec()
      expect(loader.hubSpec).toMatchObject({
        hubURL: ['https://example.com/hub.txt'],
      })
    })
  })

  describe('activate/deactivate', () => {
    const reloadCb = () => {}

    it('builds when ready flips true', async () => {
      const { createPluginManager } = jest.requireMock('./createPluginManager')
      const loader = SessionLoader.create({
        configSnapshot: { assemblies: [] },
        initialTimestamp: Date.now(),
      })
      loader.activate(reloadCb)
      // not ready yet
      expect(createPluginManager).not.toHaveBeenCalled()
      // becoming ready in the model triggers the autorun
      loader.setBlankSession(true)
      loader.setRuntimePlugins([])
      await when(() => loader.ready)
      expect(createPluginManager).toHaveBeenCalledTimes(1)
      loader.deactivate()
    })

    it('is idempotent — second activate is a no-op', () => {
      const loader = SessionLoader.create({ initialTimestamp: Date.now() })
      loader.activate(reloadCb)
      const firstDisposer = loader.buildAutorunDisposer
      loader.activate(reloadCb)
      expect(loader.buildAutorunDisposer).toBe(firstDisposer)
      loader.deactivate()
    })

    it('deactivate stops the autorun and disposes pluginManager', async () => {
      const { createPluginManager } = jest.requireMock('./createPluginManager')
      createPluginManager.mockClear()
      const loader = SessionLoader.create({
        configSnapshot: { assemblies: [] },
        initialTimestamp: Date.now(),
      })
      loader.activate(reloadCb)
      loader.setBlankSession(true)
      loader.setRuntimePlugins([])
      await when(() => loader.ready)
      expect(createPluginManager).toHaveBeenCalledTimes(1)
      loader.deactivate()
      expect(loader.buildAutorunDisposer).toBeUndefined()
      expect(loader.pluginManager).toBeUndefined()
    })
  })

  describe('readSessionFromStorage', () => {
    it('returns the snapshot when query matches session id in storage', () => {
      const sessionSnap = { id: 'test-session-id', name: 'Test' }
      sessionStorage.setItem(
        'current',
        JSON.stringify({ session: sessionSnap }),
      )
      expect(readSessionFromStorage('test-session-id')).toEqual(sessionSnap)
    })

    it('returns undefined when query does not match', () => {
      sessionStorage.setItem(
        'current',
        JSON.stringify({ session: { id: 'different-id', name: 'Test' } }),
      )
      expect(readSessionFromStorage('test-session-id')).toBeUndefined()
    })

    it('returns undefined when sessionStorage is empty', () => {
      expect(readSessionFromStorage('test-session-id')).toBeUndefined()
    })
  })

  // afterCreate is async, so these tests use `when` to wait for the loader to
  // settle. They verify the full config-load → session-dispatch pipeline.
  describe('afterCreate integration', () => {
    it('fetches config and sets blank session when no session query', async () => {
      const loader = SessionLoader.create({ initialTimestamp: Date.now() })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.configSnapshot).toBeDefined()
      expect(loader.blankSession).toBe(true)
    })

    it('skips config fetch when configSnapshot is pre-set (HMR/plugin reload path)', async () => {
      const loader = SessionLoader.create({
        configSnapshot: { assemblies: [] },
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.blankSession).toBe(true)
      expect(loader.runtimePlugins).toBeDefined()
    })

    it('restores pre-set sessionSnapshot and loads plugins (plugin reload path)', async () => {
      const sessionSnapshot = { id: 'restored-id', name: 'Restored' }
      const loader = SessionLoader.create({
        configSnapshot: {},
        sessionSnapshot,
        initialTimestamp: Date.now(),
      })
      await when(() => loader.ready, { timeout: 5000 })
      expect(loader.sessionSnapshot).toMatchObject({ name: 'Restored' })
      expect(loader.sessionPlugins).toBeDefined()
    })

    // The plugin-reload/HMR path pre-sets sessionSnapshot from the user's own
    // live session. Its plugins were already accepted when added in-session, so
    // restoring must not bounce the user back through triage even if a plugin
    // is from an untrusted (non-store) URL.
    it('reload path restores own session with an untrusted plugin without re-triaging', async () => {
      const { checkPlugins } = jest.requireMock('./util')
      checkPlugins.mockResolvedValueOnce(false)
      const loader = SessionLoader.create({
        configSnapshot: {},
        sessionSnapshot: {
          id: 'restored-id',
          name: 'Restored',
          sessionPlugins: [
            { name: 'Custom', url: 'https://example.com/custom.js' },
          ],
        },
        initialTimestamp: Date.now(),
      })
      await when(
        () =>
          loader.sessionPlugins !== undefined ||
          loader.sessionTriaged !== undefined,
        { timeout: 5000 },
      )
      expect(loader.sessionTriaged).toBeUndefined()
      expect(loader.sessionPlugins).toBeDefined()
    })

    it('sets configError and skips session loading when config fetch fails', async () => {
      const { openLocation } = jest.requireMock('@jbrowse/core/util/io')
      openLocation.mockReturnValueOnce({
        readFile: jest.fn().mockRejectedValue(new Error('Network error')),
      })
      const loader = SessionLoader.create({ initialTimestamp: Date.now() })
      await when(() => !!loader.configError, { timeout: 5000 })
      expect(loader.configError).toBeDefined()
      expect(loader.blankSession).toBe(false)
    })

    it('dispatches spec session', async () => {
      const spec = { views: [{ type: 'LinearGenomeView' }] }
      const loader = SessionLoader.create({
        sessionQuery: `spec-${JSON.stringify(spec)}`,
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSpec).toEqual(spec)
    })

    it('dispatches JB1-style session (loc + assembly)', async () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        assembly: 'hg38',
        tracks: 'track1,track2',
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSpec).toMatchObject({
        views: [
          expect.objectContaining({ loc: 'chr1:1-1000', assembly: 'hg38' }),
        ],
      })
    })

    it('dispatches hub session — sets hubSpec and blankSession', async () => {
      const loader = SessionLoader.create({
        hubURL: ['https://example.com/hub.txt'],
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.hubSpec).toMatchObject({
        hubURL: ['https://example.com/hub.txt'],
      })
      expect(loader.blankSession).toBe(true)
    })

    it('sets sessionError for unrecognized session format', async () => {
      const loader = SessionLoader.create({
        sessionQuery: 'unrecognized-format-xyz',
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionError).toBeDefined()
    })

    it('sets sessionError when a session loader throws', async () => {
      const loader = SessionLoader.create({
        sessionQuery: 'local-nonexistent',
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionError).toBeDefined()
    })
  })

  describe('createSessionLoaderFromUrl', () => {
    const setSearch = (qs: string) => {
      window.history.replaceState(null, '', `${window.location.pathname}${qs}`)
    }

    it('parses scalar params and strips consumed keys from URL', () => {
      setSearch(
        '?config=foo.json&session=local-abc&loc=chr1:1-100&assembly=hg38&password=p&adminKey=a',
      )
      const loader = createSessionLoaderFromUrl(123)
      expect(loader.configPath).toBe('foo.json')
      expect(loader.sessionQuery).toBe('local-abc')
      expect(loader.loc).toBe('chr1:1-100')
      expect(loader.assembly).toBe('hg38')
      expect(loader.password).toBe('p')
      expect(loader.adminKey).toBe('a')
      expect(loader.initialTimestamp).toBe(123)

      // adminKey, config, session preserved; loc, assembly, password stripped
      const after = new URLSearchParams(window.location.search)
      expect(after.get('config')).toBe('foo.json')
      expect(after.get('session')).toBe('local-abc')
      expect(after.get('adminKey')).toBe('a')
      expect(after.get('loc')).toBeNull()
      expect(after.get('assembly')).toBeNull()
      expect(after.get('password')).toBeNull()
    })

    it('parses hubURL as comma-separated list', () => {
      setSearch('?hubURL=https://a/hub.txt,https://b/hub.txt')
      const loader = createSessionLoaderFromUrl(0)
      expect(loader.hubURL).toEqual(['https://a/hub.txt', 'https://b/hub.txt'])
    })

    it('treats tracklist=true as true and any other value as false', () => {
      setSearch('?tracklist=true')
      expect(createSessionLoaderFromUrl(0).tracklist).toBe(true)
      setSearch('?tracklist=false')
      expect(createSessionLoaderFromUrl(0).tracklist).toBe(false)
      setSearch('')
      expect(createSessionLoaderFromUrl(0).tracklist).toBe(false)
    })

    it('treats nav=false as false and any other value (incl. absent) as true', () => {
      setSearch('?nav=false')
      expect(createSessionLoaderFromUrl(0).nav).toBe(false)
      setSearch('?nav=true')
      expect(createSessionLoaderFromUrl(0).nav).toBe(true)
      setSearch('')
      expect(createSessionLoaderFromUrl(0).nav).toBe(true)
    })
  })

  describe('reloadSessionLoader', () => {
    it('copies prev snapshot and overrides config/session snapshots + timestamp', () => {
      const prev = SessionLoader.create({
        configPath: '/c.json',
        adminKey: 'admin',
        sessionQuery: 'local-x',
        initialTimestamp: 1,
      })
      const next = reloadSessionLoader(
        prev,
        { assemblies: ['hg38'] },
        { id: 'new', name: 'new session' },
      )
      expect(next.configPath).toBe('/c.json')
      expect(next.adminKey).toBe('admin')
      expect(next.sessionQuery).toBe('local-x')
      expect(next.configSnapshot).toEqual({ assemblies: ['hg38'] })
      expect(next.sessionSnapshot).toEqual({ id: 'new', name: 'new session' })
      expect(next.initialTimestamp).not.toBe(1)
    })
  })

  describe('snapshot serialization', () => {
    it('creates with minimal snapshot', () => {
      const loader = SessionLoader.create({
        initialTimestamp: 1234567890,
      })
      const snap = getSnapshot(loader)
      expect(snap.initialTimestamp).toBe(1234567890)
    })

    it('creates with full snapshot', () => {
      const loader = SessionLoader.create({
        configPath: '/path/to/config.json',
        sessionQuery: 'local-abc123',
        password: 'secret',
        adminKey: 'admin123',
        loc: 'chr1:1-1000',
        sessionTracks: '[]',
        assembly: 'hg38',
        tracks: 'track1',
        tracklist: true,
        highlight: 'chr1:100-200',
        nav: false,
        initialTimestamp: 1234567890,
        hubURL: ['https://example.com/hub.txt'],
        configSnapshot: { assemblies: [] },
        sessionSnapshot: { id: 'test' },
      })
      const snap = getSnapshot(loader)
      expect(snap.configPath).toBe('/path/to/config.json')
      expect(snap.sessionQuery).toBe('local-abc123')
      expect(snap.hubURL).toEqual(['https://example.com/hub.txt'])
    })
  })
})
