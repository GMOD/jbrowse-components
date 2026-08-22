import { resolveConf } from '@jbrowse/core/configuration'
import { encodeSessionParam, fromUrlSafeB64 } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { bakePromotedDefaultsIntoSnapshot } from '@jbrowse/product-core'
import { isObservable } from 'mobx'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type {
  AnyConfigurationModel,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'
const DISPLAY_TYPE = 'LinearVariantDisplay'
// a promotable sentinel slot on the canvas base display: default 'inherit'
// resolves to promotedBase 'normal'
const SLOT = 'displayMode'
const PROMOTED = 'compact'

interface TestView {
  launchTrack: (id: string) => Promise<unknown>
  tracks: {
    configuration: AnyConfigurationModel
    displays: { type: string }[]
  }[]
}
interface TestSession {
  views: TestView[]
  tracks: AnyConfigurationModel[]
  trackConfigDeltas: Record<string, { displays?: { displayId: string }[] }>
  setDisplayTypeDefault: (type: string, slot: string, value: unknown) => void
  getDisplayTypeDefault: (type: string, slot: string) => unknown
}

beforeEach(() => {
  // promoted defaults persist to localStorage (PreferencesSessionMixin), so
  // clear it or one test's promotion leaks into the next
  localStorage.clear()
  doBeforeEach()
})

async function openVcfDisplay(adminMode = false) {
  const { rootModel } = await getPluginManager(undefined, adminMode)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  await view.launchTrack(TRACK_ID)
  const display = view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
    .displays[0]! as unknown as ResolvableDisplay
  return { rootModel, session, display }
}

test('a track following a promoted default bakes the resolved value into the shared snapshot', async () => {
  const { rootModel, session, display } = await openVcfDisplay()

  // sanity: no promotion yet, display resolves to promotedBase
  expect(resolveConf(display, SLOT)).toBe('normal')

  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  expect(resolveConf(display, SLOT)).toBe(PROMOTED)

  const snap = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  // the inherited value is baked into the admin-base track's delta, keyed by
  // displayId, so it travels with the document
  const delta = (
    snap.trackConfigDeltas as Record<
      string,
      { displays: Record<string, unknown>[] }
    >
  )[TRACK_ID]
  expect(delta).toBeDefined()
  const bakedDisplay = delta!.displays.find(
    d => (d.displayId as string).length > 0,
  )!
  expect(bakedDisplay[SLOT]).toBe(PROMOTED)
})

// A promoted default is handed straight back out by `getConf`, so it must never
// be a MobX Proxy: V8's structured-clone serializer rejects one, and every
// boundary a resolved value crosses runs that algorithm —
// `worker.postMessage(rpcProps())`, electron IPC, the share bake's
// `structuredClone`. An object-valued promotable slot (alignments `colorBy`) is
// the case that reaches it, and `preferencesOverrides` is declared `deep: false`
// for exactly this reason. This asserts the proxy-ness rather than the clone,
// because jsdom has no `structuredClone` and the repo shims it with a JSON
// round-trip that accepts a proxy; `promotedValueCloneable.test.ts` opts into the
// node environment to pin the clone semantics themselves.
test('a promoted object default is stored plain, not wrapped in a mobx proxy', async () => {
  const { session } = await openVcfDisplay()
  const colorBy = { type: 'insertSizeAndOrientation' }
  session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'colorBy', colorBy)

  const promoted = session.getDisplayTypeDefault(
    'LinearAlignmentsDisplay',
    'colorBy',
  )
  expect(isObservable(promoted)).toBe(false)
  expect(promoted).toEqual(colorBy)
})

test('the bake writes only track config, never display state', async () => {
  // the bake's whole mechanism is that a baked value lands in the track's config
  // and so reads as *customized* on the recipient's side, which is the top of the
  // cascade. It therefore needs nothing on the display node — no per-display
  // opt-out flag, which is what a second shape-aware walk used to exist to stamp.
  const { rootModel, session } = await openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const snap = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  const views = snap.views as { tracks: { displays: object[] }[] }[]
  const displays = views.flatMap(v => v.tracks.flatMap(t => t.displays))
  expect(displays.length).toBeGreaterThan(0)
  for (const d of displays) {
    expect(d).not.toHaveProperty('ignorePromotedDefaults')
  }
})

test('the shared snapshot reproduces the sender value in a recipient with no promoted default', async () => {
  const { rootModel, session, display } = await openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  expect(resolveConf(display, SLOT)).toBe(PROMOTED)

  const shared = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  // fresh recipient: no promoted defaults of their own
  const { rootModel: recipient, pluginManager: recipientPlugins } =
    await getPluginManager(undefined, false)
  // the shared snapshot names the display that was open when it was baked, and
  // setSession is synchronous
  await recipientPlugins.preloadSessionTypes(shared)
  recipient.setSession(shared)
  const recipientSession = recipient.session as unknown as TestSession
  const recipientDisplay = recipientSession.views[0]!.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.displays[0]! as unknown as ResolvableDisplay

  expect(resolveConf(recipientDisplay, SLOT)).toBe(PROMOTED)
})

test("a sender at base picks up the recipient's own promoted default", async () => {
  // The one case the bake deliberately does not cover, asserted so the trade is
  // visible rather than discovered. The sender was at `base`, so there is nothing
  // to bake — the value equals base and `stripDefault` drops it from the snapshot
  // either way — and no value can express "I deliberately saw the default". The
  // recipient's own cascade therefore applies, exactly as their own theme does.
  // Covering this needs a per-display `ignorePromotedDefaults` flag, which was
  // removed: it cost a second walk that had to track the bake's by hand, and it
  // detached received tracks from the recipient's pins for good.
  const { rootModel, session, display } = await openVcfDisplay()
  expect(resolveConf(display, SLOT)).toBe('normal')

  const shared = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  const { rootModel: recipient, pluginManager: recipientPlugins } =
    await getPluginManager(undefined, false)
  // the shared snapshot names the display that was open when it was baked, and
  // setSession is synchronous
  await recipientPlugins.preloadSessionTypes(shared)
  recipient.setSession(shared)
  const recipientSession = recipient.session as unknown as TestSession
  recipientSession.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  const recipientDisplay = recipientSession.views[0]!.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.displays[0]! as unknown as ResolvableDisplay

  expect(resolveConf(recipientDisplay, SLOT)).toBe(PROMOTED)
})

test("a recipient's promoted default cannot override a baked value", async () => {
  // the complement, and the reason the flag is unnecessary for every case that
  // has a value: a baked value is a track config value, so it reads as
  // customized and the recipient's session tier is never consulted.
  const { rootModel, session } = await openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const shared = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  const { rootModel: recipient, pluginManager: recipientPlugins } =
    await getPluginManager(undefined, false)
  // the shared snapshot names the display that was open when it was baked, and
  // setSession is synchronous
  await recipientPlugins.preloadSessionTypes(shared)
  recipient.setSession(shared)
  const recipientSession = recipient.session as unknown as TestSession
  // recipient promotes something else entirely
  recipientSession.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, 'superCompact')
  const recipientDisplay = recipientSession.views[0]!.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.displays[0]! as unknown as ResolvableDisplay

  expect(resolveConf(recipientDisplay, SLOT)).toBe(PROMOTED)
})

test('a user-added (sessionTracks) track bakes into its own config, not a delta', async () => {
  // the shape a desktop self-contained export ships: the track lives in
  // sessionTracks (no admin base), so the bake writes the resolved value into
  // that config rather than a trackConfigDeltas entry
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession & {
    publishTrackConf: (c: unknown) => { trackId: string } | undefined
  }
  const view = session.views[0]!

  await view.launchTrack(TRACK_ID)
  const base = getSnapshot(
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!.configuration,
  ) as { trackId: string; displays: { type: string; displayId: string }[] }
  const clone = structuredClone(base)
  clone.trackId += '-copy'
  for (const d of clone.displays) {
    d.displayId = `${clone.trackId}-${d.type}`
  }
  const added = session.publishTrackConf(clone)!
  await view.launchTrack(added.trackId)

  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const snap = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  const sessionTrack = (
    snap.sessionTracks as {
      trackId: string
      displays: Record<string, unknown>[]
    }[]
  ).find(t => t.trackId === added.trackId)!
  expect(sessionTrack).toBeDefined()
  const bakedDisplay = sessionTrack.displays.find(d => d.type === DISPLAY_TYPE)!
  expect(bakedDisplay[SLOT]).toBe(PROMOTED)
  // the user track carries its own value, so it should NOT also get a delta
  expect(
    (snap.trackConfigDeltas as Record<string, unknown>)[added.trackId],
  ).toBeUndefined()
})

test('an opened connection track bakes into its persisted config, not a dead delta', async () => {
  // a connection track lives in neither jbrowse.tracks nor sessionTracks: its
  // config is persisted under connectionTrackConfigs, and trackConfigDeltas is
  // only ever merged over an admin base. A delta written for one is inert, so
  // the recipient would render the base value instead of what the sender saw.
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession & {
    connectionTrackConfigs: Record<
      string,
      { connectionId: string; config: Record<string, unknown> }
    >
    setConnectionTrackConfig: (
      trackId: string,
      connectionId: string,
      config: Record<string, unknown>,
    ) => void
  }
  const view = session.views[0]!

  await view.launchTrack(TRACK_ID)
  const base = getSnapshot(
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!.configuration,
  ) as { trackId: string; displays: { type: string; displayId: string }[] }
  const clone = structuredClone(base)
  clone.trackId += '-conn'
  for (const d of clone.displays) {
    d.displayId = `${clone.trackId}-${d.type}`
  }
  session.setConnectionTrackConfig(clone.trackId, 'testConnection', clone)
  await view.launchTrack(clone.trackId)

  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const snap = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  const entry = (
    snap.connectionTrackConfigs as Record<
      string,
      { config: { displays: Record<string, unknown>[] } }
    >
  )[clone.trackId]
  expect(entry).toBeDefined()
  const baked = entry!.config.displays.find(d => d.type === DISPLAY_TYPE)!
  expect(baked[SLOT]).toBe(PROMOTED)
  // and no inert delta is left behind for a track that has no admin base
  expect(
    (snap.trackConfigDeltas as Record<string, unknown>)[clone.trackId],
  ).toBeUndefined()
})

test('a connection track config with no displays array gets the baked display added', async () => {
  // a hub-provided config need not carry `displays` at all (the stubs are
  // injected at hydration), so the bake has to add the display rather than
  // assume a row to merge into
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession & {
    connectionTrackConfigs: Record<
      string,
      { connectionId: string; config: Record<string, unknown> }
    >
    setConnectionTrackConfig: (
      trackId: string,
      connectionId: string,
      config: Record<string, unknown>,
    ) => void
  }
  const view = session.views[0]!

  await view.launchTrack(TRACK_ID)
  const base = getSnapshot(
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!.configuration,
  ) as Record<string, unknown> & { trackId: string }
  const { displays: _displays, ...noDisplays } = structuredClone(base)
  noDisplays.trackId += '-conn-bare'
  session.setConnectionTrackConfig(
    noDisplays.trackId,
    'testConnection',
    noDisplays,
  )
  await view.launchTrack(noDisplays.trackId)

  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const snap = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  const entry = (
    snap.connectionTrackConfigs as Record<
      string,
      { config: { displays?: Record<string, unknown>[] } }
    >
  )[noDisplays.trackId]!
  const baked = entry.config.displays!.find(d => d.type === DISPLAY_TYPE)!
  expect(baked[SLOT]).toBe(PROMOTED)
  // the added display carries its identity, or it merges over nothing on load
  expect(typeof baked.displayId).toBe('string')
})

test('a promoted default merges into an existing delta without clobbering a prior edit', async () => {
  const { rootModel, session, display } = await openVcfDisplay()
  const s = session as unknown as TestSession & {
    jbrowse: { tracks: { trackId: string; [k: string]: unknown }[] }
    updateTrackConfiguration: (c: {
      trackId: string
      [k: string]: unknown
    }) => void
  }

  // a prior per-track edit → an existing trackConfigDeltas entry the bake must
  // merge into, not overwrite
  const base = s.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!
  s.updateTrackConfiguration({ ...base, name: 'Edited name' })
  expect(s.trackConfigDeltas[TRACK_ID]).toBeDefined()

  // then follow a promoted default on a different (display-level) slot
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const snap = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )
  const delta = (
    snap.trackConfigDeltas as Record<
      string,
      { name?: string; displays?: Record<string, unknown>[] }
    >
  )[TRACK_ID]!
  // the prior edit survives
  expect(delta.name).toBe('Edited name')
  // and the promoted value is merged in alongside it
  const baked = delta.displays!.find(d => (d.displayId as string).length > 0)!
  expect(baked[SLOT]).toBe(PROMOTED)
  // the live display never changed — bake used it read-only
  expect(resolveConf(display, SLOT)).toBe(PROMOTED)
})

test('baking does not mutate the live session (cascade stays live)', async () => {
  const { rootModel, session, display } = await openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const before = getSnapshot(rootModel.session)
  bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  // the live display still resolves through the cascade (no own value baked in)
  expect(resolveConf(display, SLOT)).toBe(PROMOTED)
  // and the serialized live session is unchanged — no delta or flag leaked back
  expect(getSnapshot(rootModel.session)).toEqual(before)
})

test('fidelity survives the real share encode/decode (long-URL round-trip)', async () => {
  const { rootModel, session, display } = await openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  expect(resolveConf(display, SLOT)).toBe(PROMOTED)

  // exactly what ShareDialog feeds buildShareUrl, then the real deflate+base64
  const shared = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )
  const { sessionParam } = await encodeSessionParam('long', shared, {
    shareURL: '',
    referer: '',
  })

  // decode the `encoded-` param exactly as SessionLoader.decodeEncodedUrlSession
  const decoded = JSON.parse(
    await fromUrlSafeB64(sessionParam.replace(/^encoded-/, '')),
  ) as Record<string, unknown>

  const { rootModel: recipient, pluginManager: recipientPlugins } =
    await getPluginManager(undefined, false)
  await recipientPlugins.preloadSessionTypes(decoded)
  recipient.setSession(decoded)
  const recipientSession = recipient.session as unknown as TestSession
  const recipientDisplay = recipientSession.views[0]!.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.displays[0]! as unknown as ResolvableDisplay

  expect(resolveConf(recipientDisplay, SLOT)).toBe(PROMOTED)
})
