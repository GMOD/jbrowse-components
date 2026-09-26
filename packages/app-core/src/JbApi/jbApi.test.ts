import PluginManager from '@jbrowse/core/PluginManager'
import {
  getReExportRegistry,
  setReExportRegistry,
} from '@jbrowse/core/ReExports/registry'
import * as configuration from '@jbrowse/core/configuration'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import * as getFeatureAdapter from '@jbrowse/core/data_adapters/getFeatureAdapter'
import * as util from '@jbrowse/core/util'
import * as aborting from '@jbrowse/core/util/aborting'
import * as mst from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'

import {
  agentByteLimit,
  createJbApi,
  ensureReExports,
  safeJson,
  sessionOf,
  undeliveredNotifications,
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
// other packages (AppReadyMarker's data-app-phase, LoadingOverlay's testid, the
// display chrome's data-display-animating), so a rename there would otherwise
// only surface as a settle that never settles.
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

  it('does not settle while a display is animating', async () => {
    document.body.innerHTML =
      '<div data-app-phase="ready"></div><div data-display-animating="true"></div>'
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

  // A display that loaded a config it cannot draw as written stays `ready`
  // and raises no toast; its corner notice is the only place the problem is
  // said, and a caller with no screen cannot read it.
  it('names a track whose display drew around a problem', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const track = (trackId: string, notices: string[]) => ({
      type: 'FeatureTrack',
      configuration: { trackId },
      activeDisplay: {
        type: 'LinearMarkDisplay',
        displayPhase: 'ready',
        notices,
      },
    })
    const session = {
      views: [
        {
          id: 'v1',
          type: 'LinearGenomeView',
          initialized: true,
          ownViews: [],
          ownTracks: [
            track('plotted', []),
            track('valueless', ['mark 0 encoding.y: a bar names no field']),
          ],
        },
      ],
      snackbarMessages: [],
    } as unknown as AbstractSessionModel
    expect(await waitReady(5000, session)).toMatchObject({
      settled: true,
      notReady: [
        {
          trackId: 'valueless',
          notices: ['mark 0 encoding.y: a bar names no field'],
        },
      ],
    })
  })

  // AppReadyMarker holds the app `loading` while a view is still applying its
  // launch blob — `initialized` goes true the moment a linear view's regions
  // land, with the spec's tracks still to attach. This is the half that says so
  // when the settle runs out there; a term in the marker and not here is a
  // settle answering `false` with an empty notReady, which is what the marker's
  // own comment calls answering false with no reason.
  it('names a view still applying what it was launched with', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const launching = {
      views: [
        {
          id: 'v1',
          type: 'LinearGenomeView',
          initialized: true,
          pendingLaunch: { assembly: 'volvox', tracks: ['genes'] },
          ownViews: [],
          ownTracks: [],
        },
      ],
      snackbarMessages: [],
    } as unknown as AbstractSessionModel
    expect(await waitReady(5000, launching)).toMatchObject({
      notReady: [
        {
          viewId: 'v1',
          phase: 'launching',
          reason: expect.stringContaining('still applying'),
        },
      ],
    })
  })

  it('says nothing about a view whose launch blob has been consumed', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const done = {
      views: [
        {
          id: 'v1',
          type: 'LinearGenomeView',
          initialized: true,
          ownViews: [],
          ownTracks: [],
        },
      ],
      snackbarMessages: [],
    } as unknown as AbstractSessionModel
    expect(await waitReady(5000, done)).not.toHaveProperty('notReady')
  })

  // A settle is a CONSUMER of the session's toasts, so the MCP envelope's
  // promise that "every result carries notifications" only holds if whatever
  // the code's own waitReady took is handed back. Without the sink,
  // `await jb.waitReady(...); return 'ok'` dropped them.
  it("hands a settle's notifications to the sink that asked for them", async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const consumed: { level: string; message: string }[] = []
    const noisy = {
      views: [],
      snackbarMessages: [{ message: 'track x failed', level: 'error' }],
    } as unknown as AbstractSessionModel
    const jb = createJbApi(
      { rootModel: { session: noisy } } as unknown as PluginManager,
      {
        onNotifications: messages => {
          consumed.push(...messages)
        },
      },
    )
    await jb.waitReady(5000)
    expect(consumed).toEqual([{ level: 'error', message: 'track x failed' }])
    // and the toast is spent either way, so nothing double-reports it
    expect(undeliveredNotifications(noisy)).toEqual([])
  })

  // renderError is its own volatile and outranks every other phase term, so a
  // display whose renderer threw reported `phase: 'renderError'` and nothing
  // to act on, while the guide promises the phase AND the reason.
  it('names the reason a display failed to render', () => {
    const failed = {
      views: [
        {
          id: 'v1',
          type: 'LinearGenomeView',
          ownViews: [],
          ownTracks: [
            {
              type: 'FeatureTrack',
              configuration: { trackId: 'genes' },
              activeDisplay: {
                type: 'LinearBasicDisplay',
                displayPhase: 'renderError',
                renderError: new Error('no WebGL2 context'),
              },
            },
          ],
        },
      ],
      snackbarMessages: [],
      assemblyNames: ['volvox'],
    } as unknown as AbstractSessionModel
    const jb = createJbApi({
      rootModel: { session: failed },
    } as unknown as PluginManager)
    expect(jb.sessionSummary().views[0]).toMatchObject({
      tracks: [
        {
          trackId: 'genes',
          phase: 'renderError',
          renderError: 'Error: no WebGL2 context',
        },
      ],
    })
  })

  // A canceled load reads finished, so `waitReady` settles over it; this is
  // what tells the agent the track is stopped rather than drawn.
  it('reports a canceled display as not ready', () => {
    const canceled = {
      views: [
        {
          id: 'v1',
          type: 'LinearGenomeView',
          ownViews: [],
          ownTracks: [
            {
              type: 'AlignmentsTrack',
              configuration: { trackId: 'reads' },
              activeDisplay: {
                type: 'LinearAlignmentsDisplay',
                displayPhase: 'canceled',
              },
            },
          ],
        },
      ],
      snackbarMessages: [],
      assemblyNames: ['volvox'],
    } as unknown as AbstractSessionModel
    const jb = createJbApi({
      rootModel: { session: canceled },
    } as unknown as PluginManager)
    expect(jb.sessionSummary().views[0]).toMatchObject({
      tracks: [{ trackId: 'reads', phase: 'canceled' }],
    })
  })

  // A drawer widget takes a column off every view and a modal covers the app,
  // so both make a screenshot look right and be wrong — the same class as
  // `offscreen`, and previously reported nowhere: every filmed take told the
  // agent to close the track selector in its system prompt instead.
  it('names the drawer and any modal over the views', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const covered = {
      views: [],
      snackbarMessages: [],
      assemblyNames: ['volvox'],
      drawerVisible: true,
      drawerWidth: 384,
      visibleWidget: { type: 'HierarchicalTrackSelectorWidget' },
      DialogComponent: () => null,
    } as unknown as AbstractSessionModel
    const jb = createJbApi({
      rootModel: { session: covered },
    } as unknown as PluginManager)
    expect(jb.sessionSummary()).toMatchObject({
      drawer: { widget: 'HierarchicalTrackSelectorWidget', width: 384 },
      dialog: {},
    })
    // and the settle says so too, since that is the report read before a
    // screenshot
    expect(await jb.waitReady(5000)).toMatchObject({
      drawer: { width: 384 },
    })
  })

  it('says nothing about chrome that is not up', () => {
    const plain = {
      views: [],
      snackbarMessages: [],
      assemblyNames: ['volvox'],
      drawerVisible: false,
    } as unknown as AbstractSessionModel
    const summary = createJbApi({
      rootModel: { session: plain },
    } as unknown as PluginManager).sessionSummary()
    expect(summary).not.toHaveProperty('drawer')
    expect(summary).not.toHaveProperty('dialog')
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
    getTrackById: () => undefined,
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
      // launchTrack, not showTrack: the display state model is lazy in every
      // plugin, and showTrack answers before its chunk lands
      launchTrack: async (trackId: string) => {
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

// Four of 32 eval runs called jb.addTrack with the trackId of a track already
// in the catalog, meaning "show this", and one wrote that trackId where the
// location goes. Both used to cost a round trip for a refusal.
describe('addTrack with a trackId the catalog already holds', () => {
  const shown: [string, unknown][] = []
  const view = {
    id: 'v1',
    type: 'LinearGenomeView',
    assemblyNames: ['volvox'],
    ownViews: [],
    ownTracks: [],
    launchTrack: async (trackId: string, _snap: object, settings: unknown) => {
      shown.push([trackId, settings])
    },
  }
  const conf = {
    trackId: 'volvox_alignments',
    type: 'AlignmentsTrack',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter' },
  }
  const session = {
    rpcManager: {},
    configuration: {},
    addSessionTrackConf: () => {},
    getTrackById: (id: string) => (id === conf.trackId ? conf : undefined),
    views: [view],
    assemblyNames: ['volvox'],
    assemblyManager: { getCanonicalAssemblyName: () => undefined },
  } as unknown as AbstractSessionModel
  const jb = createJbApi({
    rootModel: { session },
    trackTypes: new Map([['AlignmentsTrack', {}]]),
    getTrackType: () => ({ displayTypes: [{ name: 'LinearD' }] }),
    getViewType: () => ({ displayTypes: [{ name: 'LinearD' }] }),
  } as unknown as PluginManager)

  beforeEach(() => {
    shown.length = 0
  })

  // the same report the file route answers with, so one call has one shape
  it('shows it, with the settings it was given', async () => {
    expect(
      await jb.addTrack({
        trackId: 'volvox_alignments',
        settings: { height: 300 },
        settleMs: 0,
      }),
    ).toEqual({
      trackId: 'volvox_alignments',
      trackType: 'AlignmentsTrack',
      assembly: 'volvox',
      adapterType: 'BamAdapter',
      shownInView: 'v1',
    })
    expect(shown).toEqual([['volvox_alignments', { height: 300 }]])
  })

  it('takes the trackId written where a location goes', async () => {
    await jb.addTrack({ location: 'volvox_alignments', settleMs: 0 })
    expect(shown).toEqual([['volvox_alignments', undefined]])
  })

  it('shows nothing under show:false, as the file route does not', async () => {
    expect(
      await jb.addTrack({ trackId: 'volvox_alignments', show: false }),
    ).toMatchObject({ trackId: 'volvox_alignments' })
    expect(shown).toEqual([])
  })

  // `trackId` beside `location` is how a track CONFIG spells this, and reading
  // it as the catalog route refused the file the caller asked to add
  it('adds the file when the location names one', async () => {
    expect(
      await jb.addTrack({
        trackId: 'volvox_alignments',
        location: ['https://x.org/a.bw', 'https://x.org/b.bw'],
        show: false,
      }),
    ).toMatchObject({ adapterType: 'MultiWiggleAdapter' })
    expect(shown).toEqual([])
  })

  // index, assembly and name describe the file; the catalog's copy has them
  // already, so taking the call and dropping them is the silent answer
  it('refuses the file keys over a catalog trackId', async () => {
    await expect(
      jb.addTrack({ trackId: 'volvox_alignments', assembly: 'volvox2' }),
    ).rejects.toThrow(/is in the catalog already, so assembly would be ignored/)
    await expect(
      jb.addTrack({
        trackId: 'volvox_alignments',
        name: 'Renamed',
        index: '/x.bai',
      }),
    ).rejects.toThrow(/so index and name would be ignored — drop them/)
    expect(shown).toEqual([])
  })

  it('names the catalog for a trackId in neither place', async () => {
    await expect(jb.addTrack({ trackId: 'nope' })).rejects.toThrow(
      /No track with trackId "nope" — jb.listTracks\(\)/,
    )
    await expect(jb.addTrack({})).rejects.toThrow(
      /needs a location .* or the trackId of a track already in the catalog/,
    )
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
      /2 views show "genes": v1 \(LinearGenomeView on volvox at ctgA:1-100\); v2 .*pass viewId/,
    )
    expect(jb.trackModel('genes', 'v2')).toBe(jb.view('v2').ownTracks[0])
    expect(() => jb.trackModel('genes', 'nope')).toThrow(/No view with id/)
  })

  it('summarizes a view whose views getter lists axes that are not views', () => {
    const jb = jbOver([
      {
        id: 'dp',
        type: 'DotplotView',
        initialized: true,
        views: [{ displayedRegions: [] }, { displayedRegions: [] }],
        ownViews: [],
        ownTracks: [track('synteny')],
      },
    ])
    expect(jb.sessionSummary().views).toEqual([
      expect.objectContaining({ id: 'dp', tracks: [expect.anything()] }),
    ])
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
      /"variants" is not shown in any open view — await view.launchTrack\("variants"\)/,
    )
    expect(() => jb.trackModel('variants', 'v1')).toThrow(
      /not shown in any view in v1/,
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

  // the 129 volvox rows were 20 KB, the largest result in nearly every agent
  // run; the adapter type is what goes, and every row keeps one shape
  it('lists each assembly sequence track beside the catalog', () => {
    expect(jb.listTracks()).toEqual({
      total: 2,
      tracks: [
        {
          trackId: 'genes',
          name: 'genes',
          type: 'FeatureTrack',
          assemblyNames: ['volvox'],
        },
        {
          trackId: 'volvox_refseq',
          name: 'volvox sequence',
          type: 'ReferenceSequenceTrack',
          assemblyNames: ['volvox'],
        },
      ],
    })
    expect(jb.listTracks('refseq').tracks.map(t => t.trackId)).toEqual([
      'volvox_refseq',
    ])
  })
})

// Three of 32 eval runs wrote jb.inspect('views[0]') against a surface that
// took 'views.0'. The path grammar is gone: the node is the argument, and the
// agent already holds one.
describe('inspect', () => {
  const session = {
    views: [
      {
        id: 'v1',
        type: 'LinearGenomeView',
        tracks: [{ id: 't0' }, { id: 't1' }],
      },
    ],
    widgets: {
      'hierarchical-track-selector': {
        type: 'HierarchicalTrackSelectorWidget',
      },
    },
  } as unknown as AbstractSessionModel
  const jb = createJbApi({
    rootModel: { session },
  } as unknown as PluginManager)

  it('takes the node, and bare takes the session', () => {
    expect(jb.inspect(session.views[0])).toMatchObject({ value: { id: 'v1' } })
    expect(
      jb.inspect(
        (session.views[0] as unknown as { tracks: unknown[] }).tracks[1],
      ),
    ).toMatchObject({ value: { id: 't1' } })
    expect(jb.inspect()).toMatchObject({
      value: { views: [{ id: 'v1' }] },
    })
    expect(jb.inspect()).not.toHaveProperty('path')
  })

  // the old spelling, and the one an agent invents for a trackId: both name the
  // idiomatic call rather than walking a grammar of our own
  it('refuses a string, naming the node form', () => {
    expect(() => jb.inspect('views.0')).toThrow(
      /jb.inspect takes the node itself, not the name "views.0" — jb.inspect\(jb.view\(\)\)/,
    )
    expect(() => jb.inspect('volvox_alignments')).toThrow(
      /jb.inspect\(jb.trackModel\('someTrackId'\)\)/,
    )
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

  it('names its own deadline when the read times out', async () => {
    jest.useFakeTimers()
    jest.spyOn(rpcManager, 'call').mockImplementationOnce(
      (...args: unknown[]) =>
        new Promise<never>((_resolve, reject) => {
          const { signal } = args[2] as { signal: AbortSignal }
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
    const read = jb.getFeatures('genes', 'ctgA:1-100').catch((e: unknown) => e)
    await jest.advanceTimersByTimeAsync(120_000)
    expect(`${await read}`).toMatch(/gave up .* after 120s/)
    jest.useRealTimers()
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

  // A region in hand — jb.visibleRegions' answer, a feature's coordinates —
  // written as loc used to reach parseLocString and die there with
  // "endsWith is not a function".
  it('takes a region object as loc', async () => {
    await jb.getFeatures({
      trackId: 'genes',
      loc: { refName: 'ctgA', start: 10, end: 20 },
    })
    expect(calls[0]?.[2]).toMatchObject({
      regions: [
        { refName: 'ctgA', start: 10, end: 20, assemblyName: 'volvox' },
      ],
    })
  })

  // A regions entry used to go straight to the fetch: no canonical rename, and
  // with no assemblyName the worker had nothing to rename against, so an alias
  // spelling read empty and said nothing.
  it('canonicalizes a regions entry the way it does loc', async () => {
    await jb.getFeatures({
      trackId: 'genes',
      regions: [{ refName: 'ctgA', start: 0, end: 100 }],
    })
    expect(calls[0]?.[2]).toMatchObject({
      regions: [
        { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
      ],
    })
  })

  it('refuses a refName the assembly lacks in regions, not only in loc', async () => {
    await expect(
      jb.getFeatures({
        trackId: 'genes',
        regions: [{ refName: 'chrA', start: 0, end: 100 }],
      }),
    ).rejects.toThrow(/"chrA" is not a sequence in volvox/)
  })

  // the string form asks parseLocString this; the object form skipping it read
  // empty, which is the answer this surface exists to turn into an error
  it('refuses a refName the assembly does not have', async () => {
    await expect(
      jb.getFeatures({
        trackId: 'genes',
        loc: { refName: 'chrA', start: 10, end: 20 },
      }),
    ).rejects.toThrow(/"chrA" is not a sequence in volvox/)
    expect(calls).toHaveLength(0)
  })

  // one place is loc; several are regions, which already takes them
  it('names the forms for a loc that is neither, and a list', async () => {
    await expect(
      // @ts-expect-error the shape being refused
      jb.getFeatures({ trackId: 'genes', loc: { start: 10, end: 20 } }),
    ).rejects.toThrow(
      /loc as ONE place — a locstring \("ctgA:1-100"\) or a region object/,
    )
    await expect(
      // @ts-expect-error a list of regions is what `regions` takes
      jb.getFeatures('genes', [{ refName: 'ctgA', start: 10, end: 20 }]),
    ).rejects.toThrow(/several regions go in regions: \[\.\.\.\]/)
    expect(calls).toHaveLength(0)
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

  // Every member is either a helper that turns a silent wrong answer into a
  // throw or a report, or one of four foundations (the two libraries and the
  // two config readers). `getConf` looks like a fifth wheel beside
  // `readConfObject` and is the first kind: handed a state model,
  // readConfObject reads that MODEL's member, so it answers undefined for a
  // real slot and answers a model property that is no slot at all. See
  // core/configuration/getConf.test.ts. Internals — abort checks, RPC session ids, region
  // renaming, locstring parsing, the adapter builder — reach an agent through jb.require('@jbrowse/core/util'), the
  // registry plugins link against, rather than as fixtures of this surface.
  it('is the documented 23 members', () => {
    expect(Object.keys(jb).sort()).toEqual([
      'addTrack',
      'addView',
      'describeSlots',
      'ensureRequire',
      'fitToWindow',
      'getConf',
      'getFeatures',
      'help',
      'inspect',
      'listTracks',
      'loadSessionSpec',
      'mobx',
      'mst',
      'readConfObject',
      'require',
      'rootModel',
      'session',
      'sessionSummary',
      'setSession',
      'trackModel',
      'view',
      'visibleRegions',
      'waitReady',
    ])
  })

  it('hands through no core export beyond the frozen re-exports', () => {
    const frozen = new Set(['getConf', 'mobx', 'mst', 'readConfObject'])
    const coreExports = new Set<unknown>(
      [configuration, getFeatureAdapter, util, aborting].flatMap(m =>
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

// A synteny view's rows count as open views: they are what shows a region and
// a track. An agent looking at one synteny view read "3 views are open" with
// nothing saying two of them were its rows, and a region read addressed to the
// synteny view's own id answered "no view shows a region" over a view plainly
// on screen.
describe('rows of a nested view', () => {
  const launched: string[] = []
  const row = (id: string, assembly: string, loc: string) => ({
    id,
    type: 'LinearGenomeView',
    assemblyNames: [assembly],
    coarseVisibleLocStrings: loc,
    initialized: true,
    visibleRegions: [
      { refName: 'ctgA', start: 0, end: 100, assemblyName: assembly },
    ],
    ownViews: [],
    ownTracks: [{ configuration: { trackId: `genes_${assembly}` } }],
    launchTrack: async () => {
      launched.push(id)
    },
  })
  const jb = createJbApi({
    rootModel: {
      session: {
        rpcManager: {},
        configuration: {},
        addSessionTrackConf: () => {},
        views: [
          {
            id: 'syn',
            type: 'LinearSyntenyView',
            assemblyNames: ['volvox', 'volvox2'],
            ownViews: [
              row('r1', 'volvox', 'ctgA:1-100'),
              row('r2', 'volvox2', 'ctgB:1-100'),
            ],
            ownTracks: [{ configuration: { trackId: 'genes_volvox' } }],
            launchTrack: async () => {
              launched.push('syn')
            },
          },
        ],
        assemblyNames: ['volvox', 'volvox2'],
        assemblyManager: { getCanonicalAssemblyName: () => undefined },
      },
    },
    trackTypes: new Map([['MultiQuantitativeTrack', {}]]),
    getTrackType: () => ({ displayTypes: [{ name: 'LinearD' }] }),
    getViewType: (type: string) => ({
      displayTypes: [
        { name: type === 'LinearGenomeView' ? 'LinearD' : 'SyntenyD' },
      ],
    }),
  } as unknown as PluginManager)

  it('names each row as a row of its parent', () => {
    expect(() => jb.view()).toThrow(
      /3 views are open: syn \(LinearSyntenyView on volvox, volvox2\); r1 \(LinearGenomeView on volvox at ctgA:1-100, a row of syn\); r2 .*a row of syn\)/,
    )
  })

  it('searches the rows when the parent cannot answer', async () => {
    await expect(jb.visibleRegions('syn')).rejects.toThrow(
      /2 views show a region: r1 .*a row of syn\); r2 .*a row of syn\) — pass viewId/,
    )
    expect(await jb.visibleRegions('r2')).toHaveLength(1)
    expect(jb.trackModel('genes_volvox2', 'syn')).toBe(
      jb.view('r2').ownTracks[0],
    )
    expect(jb.trackModel('genes_volvox', 'syn')).toBe(
      jb.view('syn').ownTracks[0],
    )
  })

  it('adds a track to the row on its assembly, not the parent', async () => {
    const result = await jb.addTrack({
      location: ['https://x.org/a.bw'],
      assembly: 'volvox2',
      viewId: 'syn',
      settleMs: 0,
    })
    expect(result).toMatchObject({ shownInView: 'r2' })
    expect(launched).toEqual(['r2'])
  })
})

// Every filmed take spent two to five screenshot rounds shrinking things by
// hand after the settle said `offscreen`. The overflow is arithmetic the settle
// already does, so the fit spends it for the agent.
describe('fitToWindow', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })
  const sized = (height: number) => {
    const part = {
      height,
      setHeight(px: number) {
        part.height = px
      },
    }
    return part
  }
  // jsdom lays nothing out, so the page is as tall as its parts say
  function page(chrome: number, parts: { height: number }[]) {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => chrome + parts.reduce((sum, p) => sum + p.height, 0),
    })
  }
  const jbOver = (
    displays: ReturnType<typeof sized>[],
    levels: ReturnType<typeof sized>[] = [],
  ) =>
    createJbApi({
      rootModel: {
        session: {
          views: [
            {
              id: 'v',
              type: 'LinearGenomeView',
              levels,
              ownViews: [],
              ownTracks: displays.map((activeDisplay, i) => ({
                configuration: { trackId: `t${i}` },
                activeDisplay,
              })),
            },
          ],
          snackbarMessages: [],
        },
      },
    } as unknown as PluginManager)

  // Neither app scrolls the document: a column inside it does, so the
  // document read as fitting while a view ran 700 px past the window and
  // both the fit and its grader passed vacuously.
  it('measures the column the app scrolls, not the document', async () => {
    document.body.innerHTML =
      '<div data-app-phase="ready"></div><div id="column" style="overflow-y: auto"><div data-testid="view-container-v"></div></div>'
    const tall = sized(400)
    const column = document.getElementById('column')!
    Object.defineProperties(column, {
      scrollHeight: { configurable: true, get: () => 500 + tall.height },
      clientHeight: { configurable: true, value: 700 },
    })
    page(100, [])
    expect(await jbOver([tall]).fitToWindow(5000)).toEqual({
      fits: true,
      overflowBefore: 200,
      overflowAfter: 0,
      shrunk: [{ what: 't0', from: 400, to: 200 }],
      settled: true,
    })
  })

  // The spacer below the last view is room to scroll into, not session. Charged
  // to the views, its 300px came off whatever had the most headroom: the E.
  // coli take's dotplot drew a 4:1 letterbox of a plot that had room to be 600
  // px tall, and the agent then read a slope off it.
  it('leaves the overscroll spacer out of the session height', async () => {
    document.body.innerHTML =
      '<div data-app-phase="ready"></div><div id="column" style="overflow-y: auto"><div data-testid="view-container-v"></div><div data-testid="view-stack-overscroll"></div></div>'
    const tall = sized(400)
    const column = document.getElementById('column')!
    const spacer = document.querySelector<HTMLElement>(
      '[data-testid="view-stack-overscroll"]',
    )!
    spacer.getBoundingClientRect = () => ({ height: 300 }) as DOMRect
    Object.defineProperties(column, {
      scrollHeight: { configurable: true, get: () => 800 + tall.height },
      clientHeight: { configurable: true, value: 700 },
    })
    page(100, [])
    expect(await jbOver([tall]).fitToWindow(5000)).toEqual({
      fits: true,
      overflowBefore: 200,
      overflowAfter: 0,
      shrunk: [{ what: 't0', from: 400, to: 200 }],
      settled: true,
    })
  })

  it('answers plainly when the session already fits', async () => {
    page(100, [])
    expect(await jbOver([]).fitToWindow(100)).toEqual({
      fits: true,
      pageHeight: 100,
      windowHeight: 768,
    })
  })

  it('spends the overflow in proportion to headroom and reports each cut', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const tall = sized(600)
    const short = sized(100)
    const band = sized(300)
    page(168, [tall, short, band])
    expect(await jbOver([tall, short], [band]).fitToWindow(5000)).toEqual({
      fits: true,
      overflowBefore: 400,
      overflowAfter: 0,
      shrunk: [
        { what: 'view v band 0', from: 300, to: 182 },
        { what: 't0', from: 600, to: 345 },
        { what: 't1', from: 100, to: 73 },
      ],
      settled: true,
    })
  })

  // A grow-mode track's height follows its content, not its height slot, so a
  // setHeight wrote a number nothing read and the fit reported a cut that
  // never happened. resizeHeight is the display's own way out of grow.
  it('resizes a display through resizeHeight, which leaves grow mode', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const grown = {
      height: 400,
      grow: true,
      setHeight(_px: number) {},
      resizeHeight(distance: number) {
        grown.grow = false
        grown.height += distance
      },
    }
    page(500, [grown])
    expect(await jbOver([grown]).fitToWindow(5000)).toMatchObject({
      fits: true,
      shrunk: [{ what: 't0', from: 400, to: 268 }],
    })
    expect(grown.height).toBe(268)
    expect(grown.grow).toBe(false)
  })

  // A workspace scrolls each panel on its own. Measuring only the first view's
  // column read a tall second panel as fitting and shrank nothing, and read a
  // tall first panel as licence to shrink the second one too.
  it('fits each panel on its own and leaves hidden tabs alone', async () => {
    document.body.innerHTML = `<div data-app-phase="ready"></div>
      <div id="left" style="overflow-y: auto"><div data-testid="view-container-a"></div></div>
      <div id="right" style="overflow-y: auto"><div data-testid="view-container-b"></div></div>`
    const inLeft = sized(300)
    const inRight = sized(900)
    const inHiddenTab = sized(900)
    const panel = (id: string, part: { height: number }) => {
      Object.defineProperties(document.getElementById(id)!, {
        scrollHeight: { configurable: true, get: () => 100 + part.height },
        clientHeight: { configurable: true, value: 700 },
      })
    }
    panel('left', inLeft)
    panel('right', inRight)
    page(0, [])
    const view = (id: string, display: ReturnType<typeof sized>) => ({
      id,
      type: 'LinearGenomeView',
      ownViews: [],
      ownTracks: [{ configuration: { trackId: id }, activeDisplay: display }],
    })
    const jb = createJbApi({
      rootModel: {
        session: {
          views: [
            view('a', inLeft),
            view('b', inRight),
            view('c', inHiddenTab),
          ],
          snackbarMessages: [],
        },
      },
    } as unknown as PluginManager)

    expect(await jb.fitToWindow(5000)).toEqual({
      fits: true,
      overflowBefore: 300,
      overflowAfter: 0,
      shrunk: [{ what: 'b', from: 900, to: 600 }],
      settled: true,
    })
    expect(inLeft.height).toBe(300)
    expect(inHiddenTab.height).toBe(900)
  })

  it('says when the floors are what is left', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const nearFloor = sized(50)
    page(1000, [nearFloor])
    expect(await jbOver([nearFloor]).fitToWindow(5000)).toMatchObject({
      fits: false,
      overflowBefore: 282,
      overflowAfter: 272,
      shrunk: [{ what: 't0', from: 50, to: 40 }],
      note: expect.stringContaining('floor'),
    })
  })
})

// One view from one spec entry, through the same LaunchView door a spec's
// views take — not session.launchView, which is addView with a snapshot and
// never runs a view's launcher.
describe('addView', () => {
  interface StubView {
    id: string
    type: string
    displayName?: string
    args: Record<string, unknown>
    ownViews: never[]
    ownTracks: never[]
    setDisplayName: (name: string) => void
  }
  type Handler = (
    session: { views: StubView[] },
    args: Record<string, unknown>,
  ) => Promise<void>
  function harness(
    handlers: Record<string, Handler>,
    registered = ['LinearGenomeView'],
  ) {
    const views: StubView[] = []
    const session = { views, assemblyNames: ['volvox'] }
    const pluginManager = {
      rootModel: { session },
      extensionPoints: { has: (name: string) => name in handlers },
      getElementTypeRecord: () => ({
        has: (type: string) => registered.includes(type),
      }),
      getViewType: (type: string) => ({
        acceptedKeys:
          type === 'LinearGenomeView'
            ? ['id', 'displayName', 'assembly', 'loc', 'tracks']
            : undefined,
        loadStateModel: async () => undefined,
      }),
      evaluateAsyncExtensionPointStrict: (
        name: string,
        args: Record<string, unknown>,
      ) => handlers[name]?.(session, args),
    } as unknown as PluginManager
    return { session, jb: createJbApi(pluginManager) }
  }
  const lgv: Record<string, Handler> = {
    'LaunchView-LinearGenomeView': async (s, { session: _s, ...args }) => {
      const view: StubView = {
        id: 'new',
        type: 'LinearGenomeView',
        args,
        ownViews: [],
        ownTracks: [],
        setDisplayName(name) {
          view.displayName = name
        },
      }
      s.views.push(view)
    },
  }

  it('opens one view through the door a spec takes, and names it', async () => {
    const { session, jb } = harness(lgv)
    expect(
      await jb.addView(
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA',
          displayName: 'second',
        },
        0,
      ),
    ).toEqual({ viewId: 'new' })
    expect(session.views[0]).toMatchObject({
      displayName: 'second',
      args: { assembly: 'volvox', loc: 'ctgA' },
    })
    expect(session.views[0]!.args).not.toHaveProperty('type')
  })

  it('refuses a key the view does not take before opening anything', async () => {
    const { session, jb } = harness(lgv)
    await expect(
      jb.addView(
        // @ts-expect-error the misspelling being caught
        { type: 'LinearGenomeView', asembly: 'volvox' },
        0,
      ),
    ).rejects.toThrow(
      /LinearGenomeView ignored unknown key\(s\): asembly — nothing was opened/,
    )
    expect(session.views).toHaveLength(0)
  })

  // Two eval runs wrote the assemblyNames they had read off the live view's
  // snapshot, and the entry was refused as a typo.
  it('reads a one-element assemblyNames as the assembly it names', async () => {
    const { session, jb } = harness(lgv)
    await jb.addView(
      { type: 'LinearGenomeView', assemblyNames: ['volvox'], loc: 'ctgA' },
      0,
    )
    expect(session.views[0]!.args).toEqual({ assembly: 'volvox', loc: 'ctgA' })
  })

  it('refuses several assembly names, naming assembly', async () => {
    const { session, jb } = harness(lgv)
    await expect(
      jb.addView(
        { type: 'LinearGenomeView', assemblyNames: ['volvox', 'volvox2'] },
        0,
      ),
    ).rejects.toThrow(
      /LinearGenomeView takes one "assembly", and assemblyNames names 2 \(volvox, volvox2\) — pass assembly/,
    )
    expect(session.views).toHaveLength(0)
  })

  it('names an unknown type, and a type nothing here can launch', async () => {
    const { jb } = harness(lgv, ['LinearGenomeView', 'GraphGenomeView'])
    await expect(jb.addView({ type: 'Nope' }, 0)).rejects.toThrow(
      /Unknown view type\(s\) in session spec: Nope/,
    )
    await expect(jb.addView({ type: 'GraphGenomeView' }, 0)).rejects.toThrow(
      /GraphGenomeView cannot be launched from a session spec/,
    )
  })

  it("throws the launcher's own failure", async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { jb } = harness({
      'LaunchView-LinearGenomeView': async () => {
        throw new Error('No assembly provided')
      },
    })
    await expect(jb.addView({ type: 'LinearGenomeView' }, 0)).rejects.toThrow(
      /Failed to launch LinearGenomeView view: Error: No assembly provided/,
    )
    error.mockRestore()
  })
})

// The session as one document, rewritten: MST reconciles by identifier, so an
// id the document keeps is patched in place and one it drops is closed.
describe('setSession', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })
  const View = mst.types
    .model('StubView', {
      id: mst.types.identifier,
      type: mst.types.literal('StubView'),
      label: '',
    })
    .views(() => ({
      get ownViews() {
        return []
      },
      get ownTracks() {
        return []
      },
    }))
  // a view whose type registers no launch keys, as an out-of-tree plugin's does
  const PluginViewModel = mst.types
    .model('PluginView', {
      id: mst.types.identifier,
      type: mst.types.literal('PluginView'),
    })
    .views(() => ({
      get ownViews() {
        return []
      },
      get ownTracks() {
        return []
      },
    }))
  const takenOut: unknown[] = []
  const notified: string[] = []
  const Session = mst.types
    .model('StubSession', {
      name: 'test',
      views: mst.types.array(mst.types.union(View, PluginViewModel)),
    })
    .views(() => ({
      get assemblyNames() {
        return []
      },
    }))
    .actions(() => ({
      takeOutViewsMissingFrom(snapshot: unknown) {
        takenOut.push(snapshot)
      },
      notifyError(message: string) {
        notified.push(message)
      },
    }))
  const preloaded: unknown[] = []
  // StubView declares launch keys, so its accepted set is published;
  // PluginView declares none, standing in for a view whose launcher holds the
  // vocabulary (ProteinView's uniprotId), where the properties are the set
  // `legacyFlag` stands in for LinearGenomeView's `bpPerPx`: a
  // legacy spelling the view's own preProcessSnapshot converts, declared in
  // `passThrough` so `acceptedKeys` answers for it
  const stubViewType = {
    acceptedKeys: ['id', 'type', 'label', 'legacyFlag'],
    launchKeys: { keys: {}, passThrough: ['legacyFlag'] },
    stateModel: View,
  }
  const pluginViewType = { stateModel: PluginViewModel }
  const jbOver = (session: unknown) =>
    createJbApi({
      rootModel: { session },
      preloadSessionTypes: async (snapshot: unknown) => {
        preloaded.push(snapshot)
      },
      getElementTypeRecord: () => ({
        has: (name: string) => name === 'StubView' || name === 'PluginView',
      }),
      getViewType: (name: string) =>
        name === 'PluginView' ? pluginViewType : stubViewType,
    } as unknown as PluginManager)

  it('patches a kept view in place, opens a new one, and closes what the document drops', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const session = Session.create({
      views: [{ id: 'a', type: 'StubView', label: 'one' }],
    })
    const a = session.views[0]
    const jb = jbOver(session)
    const result = await jb.setSession(
      {
        views: [
          { id: 'a', type: 'StubView', label: 'two' },
          { id: 'b', type: 'StubView' },
        ],
      },
      5000,
    )
    expect(session.views[0]).toBe(a)
    expect(mst.getSnapshot(session).views[0]).toMatchObject({ label: 'two' })
    expect(session.views.map(v => v.id)).toEqual(['a', 'b'])
    expect(session.name).toBe('test')
    expect(result).toMatchObject({
      settled: true,
      session: { views: [{ id: 'a' }, { id: 'b' }] },
    })

    await jb.setSession({ views: [{ id: 'b', type: 'StubView' }] }, 5000)
    expect(session.views.map(v => v.id)).toEqual(['b'])
    // views leave through the session's own detach first, ADR-069
    expect(takenOut).toHaveLength(2)
  })

  // The document's common edit is a view already open, and MST reconciles it by
  // id without ever re-running the partition that names a typo — so this was
  // the quiet path: the key vanished, the view stayed, the settle read clean.
  it('names a key no view type takes, on a kept entry as on a new one', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    notified.length = 0
    const session = Session.create({
      views: [{ id: 'a', type: 'StubView', label: 'one' }],
    })
    const jb = jbOver(session)
    await jb.setSession(
      { views: [{ id: 'a', type: 'StubView', labl: 'two' }] },
      5000,
    )
    expect(notified).toEqual(['StubView ignored unknown key(s): labl'])

    notified.length = 0
    await jb.setSession(
      { views: [{ id: 'c', type: 'StubView', labl: 'two' }] },
      5000,
    )
    expect(notified).toEqual(['StubView ignored unknown key(s): labl'])
  })

  // A legacy key a view's own preProcessSnapshot converts works, so a document
  // naming one must not cost the call. What makes it known is the view type
  // declaring it, not whatever members the live node happens to have — a
  // getter, a volatile or an action of the same name answers to `in` while
  // writing nothing.
  it('says nothing about a legacy key the view type declares', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    notified.length = 0
    const session = Session.create({
      views: [{ id: 'a', type: 'StubView', label: 'one' }],
    })
    await jbOver(session).setSession(
      { views: [{ id: 'a', type: 'StubView', legacyFlag: true }] },
      5000,
    )
    expect(notified).toEqual([])
  })

  // The undeclared converse: `ownViews` is a getter on the live node, so the
  // heuristic this replaced called it known and said nothing while MST dropped
  // it.
  it('names an undeclared key the live view has a getter for', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    notified.length = 0
    const session = Session.create({
      views: [{ id: 'a', type: 'StubView', label: 'one' }],
    })
    await jbOver(session).setSession(
      { views: [{ id: 'a', type: 'StubView', ownViews: [] }] },
      5000,
    )
    expect(notified).toEqual(['StubView ignored unknown key(s): ownViews'])
  })

  // A view type whose launch keys live only in its launcher (the out-of-tree
  // ProteinView's uniprotId) loses them to MST with nothing said
  it('sends a launcher-only key to jb.addView instead of dropping it', async () => {
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    notified.length = 0
    await jbOver(Session.create({})).setSession(
      { views: [{ id: 'p', type: 'PluginView', uniprotId: 'P04637' }] },
      5000,
    )
    expect(notified).toEqual([
      'PluginView ignored unknown key(s): uniprotId — a document runs no launcher, so its launch keys go through jb.addView',
    ])
  })

  it('loads lazily registered types before the snapshot is applied', async () => {
    preloaded.length = 0
    document.body.innerHTML = '<div data-app-phase="ready"></div>'
    const jb = jbOver(Session.create({}))
    await jb.setSession({ views: [{ id: 'a', type: 'StubView' }] }, 5000)
    expect(preloaded).toMatchObject([{ views: [{ type: 'StubView' }] }])
  })

  it('refuses what is not a document, and a document the model rejects, by name', async () => {
    const jb = jbOver(Session.create({}))
    await expect(
      jb.setSession([] as unknown as Record<string, unknown>, 100),
    ).rejects.toThrow(/takes the session as a document/)
    await expect(
      jb.setSession({ views: [{ id: 'x', type: 'Nope' }] }, 100),
    ).rejects.toThrow(/jb\.setSession refused the document: .*Nope/)
  })
})

// Desktop's run_javascript calls this before every evaluate. A runtime plugin
// has already filled the registry with the product's map, which serves every
// bundled @jbrowse package; core's map in its place would drop those keys from
// jbrequire for the rest of the session.
test('ensureReExports keeps the registry a runtime plugin installed', async () => {
  const productMap = { '@jbrowse/display-kit/configSchema': {} }
  setReExportRegistry(productMap)
  await ensureReExports()
  expect(getReExportRegistry()).toBe(productMap)
})
