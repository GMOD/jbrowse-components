import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import SessionLoader from './SessionLoader.ts'
import {
  createSessionLoaderFromUrl,
  reloadSessionLoader,
} from './createSessionLoader.ts'
import { readSessionFromStorage } from './sessionLoaderHelpers.ts'

import type { SessionSource } from './types.ts'

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
    it('detects session query type from the prefix', () => {
      const type = (sessionQuery: string) =>
        SessionLoader.create({ sessionQuery, initialTimestamp: Date.now() })
          .sessionQueryType
      expect(type('share-abc123')).toBe('share')
      expect(type('local-abc123')).toBe('local')
      expect(type('encoded-abc123')).toBe('encoded')
      expect(type('json-{"session":{}}')).toBe('json')
      expect(type('spec-{"views":[]}')).toBe('spec')
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

    it('extendDefaultSession reads the config flag', () => {
      expect(
        SessionLoader.create({
          loc: 'chr1:1-1000',
          initialTimestamp: Date.now(),
        }).extendDefaultSession,
      ).toBe(false)

      expect(
        SessionLoader.create({
          loc: 'chr1:1-1000',
          configSnapshot: {
            configuration: { extendDefaultSessionWithUrlParams: true },
          },
          initialTimestamp: Date.now(),
        }).extendDefaultSession,
      ).toBe(true)
    })

    it('builds defaultSessionViewInit from loc when flag enabled', () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        tracks: 'a,b',
        highlight: 'chr1:5-10',
        configSnapshot: {
          configuration: { extendDefaultSessionWithUrlParams: true },
        },
        initialTimestamp: Date.now(),
      })
      expect(loader.defaultSessionViewInit).toEqual({
        loc: 'chr1:1-1000',
        assembly: undefined,
        tracks: ['a', 'b'],
        tracklist: undefined,
        nav: undefined,
        highlight: ['chr1:5-10'],
      })
    })

    it('defaultSessionViewInit is undefined when flag disabled', () => {
      expect(
        SessionLoader.create({
          loc: 'chr1:1-1000',
          initialTimestamp: Date.now(),
        }).defaultSessionViewInit,
      ).toBeUndefined()
    })

    it('extend flag routes loc to default session instead of a spec', async () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        configSnapshot: {
          configuration: { extendDefaultSessionWithUrlParams: true },
        },
        initialTimestamp: Date.now(),
      })
      await loader.loadSessionByType()
      // no spec built: resolves to the default session
      expect(loader.sessionSource).toEqual({ type: 'default' })
    })

    it('returns no session type when no query', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      expect(loader.sessionQueryType).toBeUndefined()
      expect(loader.isHubSession).toBe(false)
      expect(loader.isJb1StyleSession).toBe(false)
    })
  })

  describe('ready state getters', () => {
    it('isSessionLoaded is true once a sessionSource is resolved', () => {
      const loader = SessionLoader.create({ initialTimestamp: Date.now() })
      expect(loader.isSessionLoaded).toBe(false)
      loader.setSessionSource({ type: 'default' })
      expect(loader.isSessionLoaded).toBe(true)
    })

    it('isSessionLoaded is true for every sessionSource variant', () => {
      const isLoaded = (source: SessionSource) => {
        const loader = SessionLoader.create({ initialTimestamp: Date.now() })
        loader.setSessionSource(source)
        return loader.isSessionLoaded
      }
      expect(isLoaded({ type: 'snapshot', snapshot: { id: 'x' } })).toBe(true)
      expect(isLoaded({ type: 'spec', spec: {} })).toBe(true)
      expect(isLoaded({ type: 'hub', hubSpec: {} })).toBe(true)
      expect(isLoaded({ type: 'default' })).toBe(true)
      expect(isLoaded({ type: 'error', error: new Error('x') })).toBe(true)
    })

    it('pluginsLoaded requires only runtimePlugins for a non-snapshot session', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setSessionSource({ type: 'default' })
      expect(loader.pluginsLoaded).toBe(false)

      loader.setRuntimePlugins([])
      expect(loader.pluginsLoaded).toBe(true)
    })

    it('pluginsLoaded requires both runtime and session plugins for a snapshot session', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setSessionSource({ type: 'snapshot', snapshot: { id: 'test' } })
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
      loader.setSessionSource({ type: 'default' })
      loader.setRuntimePlugins([])
      expect(loader.ready).toBe(true)
    })

    it('ready is false when config error exists', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setSessionSource({ type: 'default' })
      loader.setRuntimePlugins([])
      loader.setConfigError(new Error('config error'))
      expect(loader.ready).toBe(false)
    })

    // regression: applyTriagedConfig used to set runtimePlugins (flipping
    // `ready` true at the await boundary) before setting configSnapshot, so the
    // build autorun could fire with configSnapshot still undefined
    it('configSnapshot is set whenever ready flips true on triage accept', async () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      loader.setSessionSource({ type: 'default' })
      let readyWithoutConfig = false
      const dispose = autorun(() => {
        if (loader.ready && !loader.configSnapshot) {
          readyWithoutConfig = true
        }
      })
      await loader.applyTriagedConfig({ assemblies: [] })
      dispose()
      expect(loader.ready).toBe(true)
      expect(loader.configSnapshot).toBeDefined()
      expect(readyWithoutConfig).toBe(false)
    })
  })

  describe('actions', () => {
    it('setSessionSource updates sessionSource', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const snapshot = { id: 'test-id', name: 'Test' }
      loader.setSessionSource({ type: 'snapshot', snapshot })
      expect(loader.sessionSource).toEqual({ type: 'snapshot', snapshot })
    })

    it('setConfigSnapshot updates configSnapshot', () => {
      const loader = SessionLoader.create({
        initialTimestamp: Date.now(),
      })
      const snap = { assemblies: [{ name: 'test' }] }
      loader.setConfigSnapshot(snap)
      expect(loader.configSnapshot).toEqual(snap)
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
      expect(loader.sessionSource).toEqual({ type: 'spec', spec })
    })
  })

  describe('decodeJb1StyleSession', () => {
    it('creates a spec sessionSource from loc and assembly', () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        assembly: 'hg38',
        tracks: 'track1,track2',
        initialTimestamp: Date.now(),
      })
      loader.decodeJb1StyleSession()
      expect(loader.sessionSource).toMatchObject({
        type: 'spec',
        spec: {
          views: [
            {
              type: 'LinearGenomeView',
              loc: 'chr1:1-1000',
              assembly: 'hg38',
              tracks: ['track1', 'track2'],
            },
          ],
        },
      })
    })
  })

  describe('decodeHubSpec', () => {
    it('creates a hub sessionSource from hubURL', () => {
      const loader = SessionLoader.create({
        hubURL: ['https://example.com/hub.txt'],
        initialTimestamp: Date.now(),
      })
      loader.decodeHubSpec()
      expect(loader.sessionSource).toMatchObject({
        type: 'hub',
        hubSpec: { hubURL: ['https://example.com/hub.txt'] },
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
      loader.setSessionSource({ type: 'default' })
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
      loader.setSessionSource({ type: 'default' })
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
    it('fetches config and sets default session when no session query', async () => {
      const loader = SessionLoader.create({ initialTimestamp: Date.now() })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.configSnapshot).toBeDefined()
      expect(loader.sessionSource).toEqual({ type: 'default' })
    })

    it('skips config fetch when configSnapshot is pre-set (HMR/plugin reload path)', async () => {
      const loader = SessionLoader.create({
        configSnapshot: { assemblies: [] },
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSource).toEqual({ type: 'default' })
      expect(loader.runtimePlugins).toBeDefined()
    })

    it('restores pre-set sessionSource snapshot and loads plugins (plugin reload path)', async () => {
      const snapshot = { id: 'restored-id', name: 'Restored' }
      const loader = SessionLoader.create({
        configSnapshot: {},
        sessionSource: { type: 'snapshot', snapshot },
        initialTimestamp: Date.now(),
      })
      await when(() => loader.ready, { timeout: 5000 })
      expect(loader.sessionSource).toMatchObject({
        type: 'snapshot',
        snapshot: { name: 'Restored' },
      })
      expect(loader.sessionPlugins).toBeDefined()
    })

    // The plugin-reload/HMR path pre-sets a snapshot sessionSource from the
    // user's own live session. Its plugins were already accepted when added
    // in-session, so restoring must not bounce the user back through triage
    // even if a plugin is from an untrusted (non-store) URL.
    it('reload path restores own session with an untrusted plugin without re-triaging', async () => {
      const { checkPlugins } = jest.requireMock('./util')
      checkPlugins.mockResolvedValueOnce(false)
      const loader = SessionLoader.create({
        configSnapshot: {},
        sessionSource: {
          type: 'snapshot',
          snapshot: {
            id: 'restored-id',
            name: 'Restored',
            sessionPlugins: [
              { name: 'Custom', url: 'https://example.com/custom.js' },
            ],
          },
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

    // Guards the vetting boundary the reload fix must NOT erode: an incoming
    // shared-session URL is not the user's own session, so an untrusted plugin
    // still routes to triage (no pre-set sessionSource → fetchSharedSession
    // path, which vets via checkPlugins without userAcceptedConfirmation).
    it('shared session with an untrusted plugin still triages on initial load', async () => {
      const { readSessionFromDynamo } = jest.requireMock('./sessionSharing')
      const { fromUrlSafeB64, checkPlugins } = jest.requireMock('./util')
      readSessionFromDynamo.mockResolvedValueOnce('encrypted-blob')
      fromUrlSafeB64.mockResolvedValueOnce(
        JSON.stringify({
          id: 'shared',
          name: 'Shared',
          sessionPlugins: [
            { name: 'Custom', url: 'https://example.com/custom.js' },
          ],
        }),
      )
      checkPlugins.mockResolvedValueOnce(false)
      const loader = SessionLoader.create({
        sessionQuery: 'share-abc',
        configSnapshot: {},
        initialTimestamp: Date.now(),
      })
      await when(
        () =>
          loader.sessionTriaged !== undefined ||
          loader.sessionSource !== undefined,
        { timeout: 5000 },
      )
      expect(loader.sessionTriaged).toMatchObject({ origin: 'session' })
      expect(loader.sessionSource).toBeUndefined()
    })

    it('sets configError and skips session loading when config fetch fails', async () => {
      const { openLocation } = jest.requireMock('@jbrowse/core/util/io')
      openLocation.mockReturnValueOnce({
        readFile: jest.fn().mockRejectedValue(new Error('Network error')),
      })
      const loader = SessionLoader.create({ initialTimestamp: Date.now() })
      await when(() => !!loader.configError, { timeout: 5000 })
      expect(loader.configError).toBeDefined()
      expect(loader.sessionSource).toBeUndefined()
    })

    it('dispatches spec session', async () => {
      const spec = { views: [{ type: 'LinearGenomeView' }] }
      const loader = SessionLoader.create({
        sessionQuery: `spec-${JSON.stringify(spec)}`,
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSource).toEqual({ type: 'spec', spec })
    })

    it('dispatches JB1-style session (loc + assembly)', async () => {
      const loader = SessionLoader.create({
        loc: 'chr1:1-1000',
        assembly: 'hg38',
        tracks: 'track1,track2',
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSource).toMatchObject({
        type: 'spec',
        spec: {
          views: [
            expect.objectContaining({ loc: 'chr1:1-1000', assembly: 'hg38' }),
          ],
        },
      })
    })

    it('dispatches hub session — sets a hub sessionSource', async () => {
      const loader = SessionLoader.create({
        hubURL: ['https://example.com/hub.txt'],
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSource).toMatchObject({
        type: 'hub',
        hubSpec: { hubURL: ['https://example.com/hub.txt'] },
      })
    })

    it('sets an error sessionSource for unrecognized session format', async () => {
      const loader = SessionLoader.create({
        sessionQuery: 'unrecognized-format-xyz',
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSource).toMatchObject({ type: 'error' })
    })

    it('sets an error sessionSource when a session loader throws', async () => {
      const loader = SessionLoader.create({
        sessionQuery: 'local-nonexistent',
        initialTimestamp: Date.now(),
      })
      await when(() => loader.isSessionLoaded, { timeout: 5000 })
      expect(loader.sessionSource).toMatchObject({ type: 'error' })
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
      expect(next.sessionSource).toEqual({
        type: 'snapshot',
        snapshot: { id: 'new', name: 'new session' },
      })
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
        sessionSource: { type: 'snapshot', snapshot: { id: 'test' } },
      })
      const snap = getSnapshot(loader)
      expect(snap.configPath).toBe('/path/to/config.json')
      expect(snap.sessionQuery).toBe('local-abc123')
      expect(snap.hubURL).toEqual(['https://example.com/hub.txt'])
    })
  })
})
