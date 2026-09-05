import {
  agentByteLimit,
  createJbApi,
  safeJson,
  sessionOf,
  waitReady,
} from './jbApi.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'

describe('safeJson', () => {
  it('reports a real cycle', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a.self = a
    expect(JSON.parse(safeJson(a))).toEqual({ name: 'a', self: '[circular]' })
  })

  // The reason the replacer tracks the ancestor chain rather than every object
  // it has seen: MST snapshots are cached and structurally shared, so one
  // frozen object legitimately appears at two paths. A visited-set calls the
  // second appearance a cycle, and the agent is told data is missing.
  it('does not call a repeated sibling a cycle', () => {
    const shared = { shared: true }
    expect(JSON.parse(safeJson({ left: shared, right: shared }))).toEqual({
      left: { shared: true },
      right: { shared: true },
    })
  })

  it('survives what a snapshot cannot hold', () => {
    expect(JSON.parse(safeJson({ fn: () => {}, big: 10n, ok: 1 }))).toEqual({
      fn: '[function]',
      big: '10',
      ok: 1,
    })
  })

  it('yields a string even when stringify does not', () => {
    expect(safeJson(undefined)).toBe('"[unserializable]"')
  })
})

describe('agentByteLimit', () => {
  it('takes the adapter over the default', () => {
    expect(agentByteLimit(1234)).toBe(1234)
  })

  it('falls back when the adapter has no opinion', () => {
    // htsget reports 0, which adapterByteLimit reads as "no opinion"
    expect(agentByteLimit(0)).toBe(5_000_000)
    expect(agentByteLimit(undefined)).toBe(5_000_000)
  })

  it('lets an explicit request win, so an agent can mean it', () => {
    expect(agentByteLimit(1234, 99)).toBe(99)
  })
})

describe('sessionOf', () => {
  it('is undefined on the start screen rather than throwing', () => {
    expect(sessionOf(undefined)).toBeUndefined()
    expect(sessionOf({ rootModel: {} } as unknown as PluginManager)).toBe(
      undefined,
    )
  })
})

// The coupling nothing else pins: waitReady reads app chrome that lives in
// other packages (AppReadyMarker's data-app-phase, LoadingOverlay's testid),
// so a rename there would otherwise only surface as a settle that never
// settles.
describe('waitReady', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  const session = {
    views: [],
    snackbarMessages: [],
  } as unknown as AbstractSessionModel

  it('does not settle while the ready marker is absent', async () => {
    expect(await waitReady(300, session)).toMatchObject({ settled: false })
  })

  it('does not settle while a loading overlay is up', async () => {
    document.body.innerHTML =
      '<div data-app-phase="ready"></div><div data-testid="loading-overlay"></div>'
    expect(await waitReady(300, session)).toMatchObject({ settled: false })
  })

  it('settles once the marker is ready and nothing is loading', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const settle = await waitReady(5000, session)
    expect(settle).toMatchObject({ settled: true })
    expect(settle).not.toHaveProperty('offscreen')
  })

  it('names the views a viewport screenshot would cut off', async () => {
    document.body.innerHTML =
      '<div data-app-phase="ready"></div><div data-testid="view-container-v2"></div>'
    const container = document.querySelector(
      '[data-testid="view-container-v2"]',
    )!
    container.getBoundingClientRect = () =>
      ({ top: 700, bottom: 1100 }) as DOMRect
    const tall = {
      views: [
        { id: 'v1', allViews: [{ id: 'v1', ownTracks: [] }] },
        { id: 'v2', allViews: [{ id: 'v2', ownTracks: [] }] },
      ],
      snackbarMessages: [],
    } as unknown as AbstractSessionModel
    expect(await waitReady(5000, tall)).toMatchObject({
      settled: true,
      offscreen: {
        windowHeight: 768,
        views: [{ viewId: 'v2', top: 700, bottom: 1100 }],
      },
    })
  })

  it('delivers each toast once, with its level, and never a stale one twice', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const toasts = [{ message: 'track x failed', level: 'error' }]
    const noisy = {
      views: [],
      snackbarMessages: toasts,
    } as unknown as AbstractSessionModel
    expect(await waitReady(5000, noisy)).toMatchObject({
      notifications: [{ level: 'error', message: 'track x failed' }],
    })
    expect(await waitReady(5000, noisy)).not.toHaveProperty('notifications')
    toasts.push({ message: 'track added', level: 'info' })
    expect(await waitReady(5000, noisy)).toMatchObject({
      notifications: [{ level: 'info', message: 'track added' }],
    })
  })

  // react-app2 embeds the app in a host page, so a second mounted app must not
  // be able to answer for this one
  it('answers for the root it is given, not the document', async () => {
    document.body.innerHTML =
      '<div id="other"><div data-app-phase="ready"></div></div><div id="mine"></div>'
    const mine = document.querySelector('#mine')!
    expect(await waitReady(300, session, mine)).toMatchObject({
      settled: false,
    })
  })
})

// In a browser a LocalPathLocation fails at the first read, inside the display,
// rather than where it was asked for.
describe('addTrack in a browser', () => {
  // rpcManager and configuration are what isSessionServices looks for, which
  // is the runtime test behind isSessionWithAddSessionTrack
  const session = {
    rpcManager: {},
    configuration: {},
    addSessionTrackConf: () => {},
    assemblyNames: ['volvox'],
  } as unknown as AbstractSessionModel
  const pluginManager = { rootModel: { session } } as unknown as PluginManager

  it('refuses a local path, naming what to do instead', async () => {
    await expect(
      createJbApi(pluginManager).addTrack({ location: '/data/x.bam' }),
    ).rejects.toThrow(/local path/)
  })

  it('stacks a list of bigWig URLs into one MultiQuantitativeTrack', async () => {
    const added: Record<string, unknown>[] = []
    const stacking = {
      ...session,
      addSessionTrackConf: (conf: Record<string, unknown>) => {
        added.push(conf)
      },
    } as unknown as AbstractSessionModel
    const jb = createJbApi({
      rootModel: { session: stacking },
    } as unknown as PluginManager)
    const summary = await jb.addTrack({
      location: ['https://x.org/a.bw', 'https://x.org/b.bigwig'],
      show: false,
    })
    expect(summary).toMatchObject({
      trackType: 'MultiQuantitativeTrack',
      adapterType: 'MultiWiggleAdapter',
    })
    expect(added[0]).toMatchObject({
      name: 'a, b',
      adapter: {
        subadapters: [
          { type: 'BigWigAdapter', name: 'a' },
          { type: 'BigWigAdapter', name: 'b' },
        ],
      },
    })
  })

  it('refuses a list that is not all bigWigs', async () => {
    await expect(
      createJbApi(pluginManager).addTrack({
        location: ['https://x.org/a.bw', 'https://x.org/b.bam'],
      }),
    ).rejects.toThrow(/not bigWig: https:\/\/x.org\/b.bam/)
  })
})

describe('getFeatures', () => {
  const session = {
    getTrackById: () => undefined,
  } as unknown as AbstractSessionModel
  const jb = createJbApi({
    rootModel: { session },
  } as unknown as PluginManager)

  it('takes the trackId positionally, the way two filmed takes wrote it', async () => {
    await expect(jb.getFeatures('genes', 'ctgA:1-100')).rejects.toThrow(
      /No track with trackId "genes"/,
    )
  })
})

// The roster is as public as the members are. jbrowse-web publishes this object
// as `window.jb` and JBrowse Desktop hands the same one to `run_javascript`, so
// a rename or a removal breaks agent code nobody in this repo can see — the
// same reason pluginFacingSessionApi.test.ts pins the shape reached through
// `window.JBrowseSession`, and the same rule as the plugin ABI: a member may be
// ADDED freely, and this list updated, but taking one away is a breaking change
// that has to be a decision rather than a refactor's side effect.
describe('the jb roster', () => {
  it('is the documented 24 members', () => {
    const jb = createJbApi({
      rootModel: {},
    } as unknown as PluginManager)
    expect(Object.keys(jb).sort()).toEqual([
      'addTrack',
      'createStopToken',
      'describeSlots',
      'ensureRequire',
      'getConf',
      'getFeatureAdapterOrThrow',
      'getFeatures',
      'getRpcSessionId',
      'help',
      'inspect',
      'listTracks',
      'loadSessionSpec',
      'mobx',
      'mst',
      'parseLocString',
      'readConfObject',
      'renameRegionsIfNeeded',
      'require',
      'rootModel',
      'session',
      'sessionSummary',
      'stopStopToken',
      'trackModel',
      'visibleRegions',
      'waitReady',
    ])
  })
})
