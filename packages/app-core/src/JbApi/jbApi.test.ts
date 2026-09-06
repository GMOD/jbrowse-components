import PluginManager from '@jbrowse/core/PluginManager'
import * as configuration from '@jbrowse/core/configuration'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import * as getFeatureAdapter from '@jbrowse/core/data_adapters/getFeatureAdapter'
import * as util from '@jbrowse/core/util'
import * as stopToken from '@jbrowse/core/util/stopToken'
import * as mst from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'

import {
  agentByteLimit,
  createJbApi,
  safeJson,
  sessionOf,
  waitReady,
} from './jbApi.ts'

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
        { id: 'v1', ownViews: [], ownTracks: [] },
        { id: 'v2', ownViews: [], ownTracks: [] },
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

  // A view whose assembly was never found paints its error in place of a
  // genome and raises no toast; it used to hold the app "loading" for good, so
  // every settle answered false with nothing said.
  it('names a view that failed to initialize, beside the tracks', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const failed = {
      views: [
        {
          id: 'v1',
          type: 'LinearGenomeView',
          initialized: false,
          error: 'Assembly volvix not found',
          get visibleRegions(): unknown {
            throw new Error('width undefined')
          },
          ownViews: [],
          ownTracks: [],
        },
        {
          id: 'v2',
          type: 'LinearGenomeView',
          initialized: false,
          ownViews: [],
          ownTracks: [],
        },
      ],
      snackbarMessages: [],
    } as unknown as AbstractSessionModel
    expect(await waitReady(5000, failed)).toMatchObject({
      settled: true,
      notReady: [
        { viewId: 'v1', error: 'Assembly volvix not found' },
        { viewId: 'v2', phase: 'initializing' },
      ],
    })
    const jb = createJbApi({
      rootModel: { session: failed },
    } as unknown as PluginManager)
    expect(jb.sessionSummary().views[0]).toMatchObject({
      id: 'v1',
      error: 'Assembly volvix not found',
    })
    await expect(jb.visibleRegions('v1')).rejects.toThrow(
      /View v1 failed to initialize: Assembly volvix not found/,
    )
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

  // a relative path resolves against the app's own working directory, which
  // under a packaged app is "/", so the track reports its failure only at
  // first fetch, through the display
  it('refuses a relative path before anything else', async () => {
    await expect(
      createJbApi(pluginManager).addTrack({ location: 'data/x.bam' }),
    ).rejects.toThrow(/"data\/x.bam" is relative/)
    await expect(
      createJbApi(pluginManager).addTrack({ location: '~/x.bam' }),
    ).rejects.toThrow(/is relative/)
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

  // no ready marker is in the document, so a settle here would run to its
  // timeout: settleMs 0 is what lets three adds pay for one wait
  it('shows the track and skips the settle when settleMs is 0', async () => {
    const shown: string[] = []
    const view = {
      id: 'v1',
      type: 'LinearGenomeView',
      assemblyNames: ['volvox'],
      ownViews: [],
      ownTracks: [],
      showTrack: (trackId: string) => {
        shown.push(trackId)
      },
    }
    const showing = {
      ...session,
      views: [view],
      addSessionTrackConf: () => {},
    } as unknown as AbstractSessionModel
    const jb = createJbApi({
      rootModel: { session: showing },
      trackTypes: new Map([['MultiQuantitativeTrack', {}]]),
      getTrackType: () => ({ displayTypes: [{ name: 'D' }] }),
      getViewType: () => ({ displayTypes: [{ name: 'D' }] }),
    } as unknown as PluginManager)
    const result = await jb.addTrack({
      location: ['https://x.org/a.bw'],
      settleMs: 0,
    })
    expect(result).toMatchObject({ shownInView: 'v1' })
    expect(result).not.toHaveProperty('settled')
    expect(shown).toEqual([result.trackId])
  })
})

// A name over a nested session has no right first answer. The named-but-missing
// case already threw and listed the open views; the unnamed-and-plural case
// does the same instead of taking the first, which restyled one row while the
// settle reported both.
describe('a name that several views could answer', () => {
  const track = (trackId: string) => ({ configuration: { trackId } })
  const lgv = (id: string, loc: string, trackIds: string[]) => ({
    id,
    type: 'LinearGenomeView',
    assemblyNames: ['volvox'],
    coarseVisibleLocStrings: loc,
    initialized: true,
    visibleRegions: [
      { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    ],
    ownViews: [],
    ownTracks: trackIds.map(track),
  })
  const jbOver = (views: unknown[]) =>
    createJbApi({
      rootModel: {
        session: {
          views,
          assemblyNames: ['volvox'],
          getTrackById: (id: string) =>
            ['genes', 'variants'].includes(id) ? { trackId: id } : undefined,
        },
      },
    } as unknown as PluginManager)

  it('names both views when a track is shown twice', () => {
    const jb = jbOver([
      lgv('v1', 'ctgA:1-100', ['genes']),
      lgv('v2', 'ctgA:5000-5100', ['genes']),
    ])
    expect(() => jb.trackModel('genes')).toThrow(
      /shown in 2 views: v1 \(LinearGenomeView on volvox at ctgA:1-100\); v2 .*pass viewId/,
    )
    expect(jb.trackModel('genes', 'v2')).toBe(jb.view('v2').ownTracks[0])
    expect(() => jb.trackModel('genes', 'nope')).toThrow(/No view with id/)
  })

  it('answers plainly when one view shows it', () => {
    const jb = jbOver([
      lgv('v1', 'ctgA:1-100', ['genes']),
      lgv('v2', 'ctgA:5000-5100', ['variants']),
    ])
    expect(jb.trackModel('genes').configuration.trackId).toBe('genes')
  })

  // undefined was followed by ".activeDisplay" on the agent's next line, and
  // the TypeError there named neither of the two causes
  it('says whether a missing track is unknown or merely not shown', () => {
    const jb = jbOver([lgv('v1', 'ctgA:1-100', ['genes'])])
    expect(() => jb.trackModel('missing')).toThrow(
      /No track with trackId "missing"/,
    )
    expect(() => jb.trackModel('variants')).toThrow(
      /"variants" is not shown in any open view — view.showTrack\("variants"\)/,
    )
    expect(() => jb.trackModel('variants', 'v1')).toThrow(
      /not shown in view v1/,
    )
  })

  it('jb.view is the open view, and asks when there are several', () => {
    const one = jbOver([lgv('v1', 'ctgA:1-100', [])])
    expect(one.view().id).toBe('v1')
    const two = jbOver([lgv('v1', 'ctgA:1-100', []), lgv('v2', 'ctgB', [])])
    expect(() => two.view()).toThrow(/2 views are open: v1 .*; v2 .*viewId/)
    expect(two.view('v2').id).toBe('v2')
    expect(() => jbOver([]).view()).toThrow(/No view is open/)
  })

  it('reads the region of the view showing the track, else asks', async () => {
    const jb = jbOver([
      lgv('v1', 'ctgA:1-100', ['genes']),
      lgv('v2', 'ctgA:5000-5100', ['variants']),
    ])
    await expect(jb.visibleRegions()).rejects.toThrow(
      /2 views show a region: .*pass viewId/,
    )
    expect(await jb.visibleRegions('v2')).toEqual([
      { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    ])
  })
})

// The config keeps each assembly's sequence track under the assembly, so no
// track list holds it; an agent that wanted bases had no trackId to ask for.
describe('listTracks', () => {
  const pluginManager = new PluginManager([]).createPluggableElements()
  pluginManager.configure()
  const adapter = ConfigurationSchema('Adapter', {
    type: { type: 'string', defaultValue: '' },
  })
  const featureTrack = ConfigurationSchema(
    'FeatureTrack',
    {
      name: { type: 'string', defaultValue: '' },
      assemblyNames: { type: 'stringArray', defaultValue: [] },
      adapter,
    },
    { explicitlyTyped: true, explicitIdentifier: 'trackId' },
  )
  const sequenceTrack = ConfigurationSchema(
    'ReferenceSequenceTrack',
    { name: { type: 'string', defaultValue: '' }, adapter },
    { explicitlyTyped: true, explicitIdentifier: 'trackId' },
  )
  const assembly = ConfigurationSchema('Assembly', {
    name: { type: 'string', defaultValue: '' },
    sequence: sequenceTrack,
  })
  const env = { pluginManager }
  const session = {
    tracks: [
      featureTrack.create(
        {
          type: 'FeatureTrack',
          trackId: 'genes',
          name: 'genes',
          assemblyNames: ['volvox'],
          adapter: { type: 'BigBedAdapter' },
        },
        env,
      ),
    ],
    assemblyManager: {
      assemblyList: [
        assembly.create(
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              name: 'volvox sequence',
              adapter: { type: 'IndexedFastaAdapter' },
            },
          },
          env,
        ),
      ],
    },
  } as unknown as AbstractSessionModel
  const jb = createJbApi({
    rootModel: { session },
  } as unknown as PluginManager)

  it('lists each assembly sequence track beside the catalog', () => {
    expect(jb.listTracks()).toMatchObject({
      total: 2,
      tracks: [
        {
          trackId: 'genes',
          type: 'FeatureTrack',
          adapterType: 'BigBedAdapter',
          assemblyNames: ['volvox'],
        },
        {
          trackId: 'volvox_refseq',
          type: 'ReferenceSequenceTrack',
          adapterType: 'IndexedFastaAdapter',
          assemblyNames: ['volvox'],
        },
      ],
    })
    expect(jb.listTracks('refseq').tracks.map(t => t.trackId)).toEqual([
      'volvox_refseq',
    ])
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

// The read is the display's own RPCs on the display's own worker: the
// sessionId is the adapter config's cache key, which is what a shown track's
// rpcSessionId is, so an index the display parsed is the one this reuses and
// a main-thread twin is never built. The synteny take wrote the options third
// and had them ignored, so that form is accepted too.
describe('getFeatures reads through the RPC', () => {
  const adapter = { type: 'BigBedAdapter', adapterId: 'genes-adapter' }
  const conf = {
    trackId: 'genes',
    adapter,
    assemblyNames: ['volvox'],
  }
  const calls: unknown[][] = []
  const rpcManager = {
    call: async (...args: unknown[]) => {
      calls.push(args)
      return args[1] === 'CoreGetRegionByteEstimate' ? 10 : []
    },
    freeSession: async () => {},
  }
  const session = {
    rpcManager,
    getTrackById: (id: string) => (id === 'genes' ? conf : undefined),
    assemblyManager: {
      waitForAssembly: async () => ({
        getCanonicalRefName: (n: string) => n,
        isValidRefName: (n: string) => n === 'ctgA',
        regions: [],
      }),
      getCanonicalAssemblyName: (n: string) => (n === 'vvx' ? 'volvox' : n),
    },
    assemblyNames: ['volvox'],
  } as unknown as AbstractSessionModel
  const jb = createJbApi({
    rootModel: { session },
  } as unknown as PluginManager)
  const adapterSpy = jest.spyOn(getFeatureAdapter, 'getFeatureAdapterOrThrow')

  beforeEach(() => {
    calls.length = 0
    adapterSpy.mockClear()
  })

  it('gates and reads on the worker the track display uses', async () => {
    await jb.getFeatures({
      trackId: 'genes',
      regions: [
        { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
      ],
    })
    expect(calls.map(c => c.slice(0, 2))).toEqual([
      ['genes-adapter', 'CoreGetRegionByteEstimate'],
      ['genes-adapter', 'CoreGetFeatures'],
    ])
    expect(adapterSpy).not.toHaveBeenCalled()
  })

  it('refuses a region over the gate before fetching it', async () => {
    await expect(
      jb.getFeatures({
        trackId: 'genes',
        regions: [
          { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
        ],
        byteLimit: 5,
      }),
    ).rejects.toThrow(/region too large/)
    expect(calls).toHaveLength(1)
  })

  it('takes the options third in the positional form', async () => {
    await expect(
      jb.getFeatures('genes', 'ctgA:1-100', { byteLimit: 5 }),
    ).rejects.toThrow(/region too large/)
    expect(calls[0]?.[2]).toMatchObject({
      regions: [{ refName: 'ctgA', start: 0, end: 100 }],
    })
  })

  // the wrong assembly renames the region against the wrong alias set and the
  // file answers with the wrong coordinates, or nothing; an alias of the right
  // one is the right one
  it('refuses an assembly the track is not on, and takes an alias of its own', async () => {
    await expect(
      jb.getFeatures('genes', 'ctgA:1-100', { assembly: 'hg38' }),
    ).rejects.toThrow(/Track "genes" is on volvox, not "hg38"/)
    expect(calls).toHaveLength(0)
    await jb.getFeatures('genes', 'ctgA:1-100', { assembly: 'vvx' })
    expect(calls).toHaveLength(2)
  })
})

// The roster is as public as the members are. jbrowse-web publishes this object
// as `window.jb` and JBrowse Desktop hands the same one to `run_javascript`, so
// a rename or a removal breaks agent code nobody in this repo can see — the
// same reason pluginFacingSessionApi.test.ts pins the shape reached through
// `window.JBrowseSession`. Taking a member away is a breaking change that has
// to be a decision rather than a refactor's side effect.
//
// Adding one is gated too. A helper earns its place by turning an answer the
// raw model gets wrong SILENTLY into a thrown error or a report (refNames
// unrenamed, a settings key dropped, a display that replaced its subtree
// without a toast, an action Object.keys cannot see). "The raw model is
// verbose" does not qualify: that is what jb.require and the model's own
// actions are for. The re-exports below are frozen at what shipped — a recipe
// teaches one and the browser agent has only jb.help — and no new member may
// be another core export handed through under a second name.
describe('the jb roster', () => {
  const jb = createJbApi({
    rootModel: {},
  } as unknown as PluginManager)

  it('is the documented 26 members', () => {
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
      'view',
      'visibleRegions',
      'waitReady',
    ])
  })

  it('hands through no core export beyond the frozen re-exports', () => {
    const frozen = new Set([
      'createStopToken',
      'getConf',
      'getFeatureAdapterOrThrow',
      'getRpcSessionId',
      'mobx',
      'mst',
      'parseLocString',
      'readConfObject',
      'renameRegionsIfNeeded',
      'stopStopToken',
    ])
    const coreExports = new Set<unknown>(
      [configuration, getFeatureAdapter, util, stopToken].flatMap(m =>
        Object.values(m),
      ),
    )
    coreExports.add(mst).add(mobx)
    const handedThrough = Object.entries(
      Object.getOwnPropertyDescriptors(jb),
    ).flatMap(([name, desc]) =>
      !frozen.has(name) && 'value' in desc && coreExports.has(desc.value)
        ? [name]
        : [],
    )
    expect(handedThrough).toEqual([])
  })
})
