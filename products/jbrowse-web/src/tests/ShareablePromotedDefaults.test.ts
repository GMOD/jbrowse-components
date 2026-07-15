import { getConfResolved } from '@jbrowse/core/configuration'
import { encodeSessionParam, fromUrlSafeB64 } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { bakePromotedDefaultsIntoSnapshot } from '@jbrowse/product-core'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type {
  AnyConfigurationModel,
  PromotableDisplay,
} from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'
const DISPLAY_TYPE = 'LinearVariantDisplay'
// a promotable sentinel slot on the canvas base display: default 'inherit'
// resolves to promotedBase 'normal'
const SLOT = 'displayMode'
const PROMOTED = 'compact'

interface TestView {
  showTrack: (id: string) => void
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
}

beforeEach(() => {
  // promoted defaults persist to localStorage (PreferencesSessionMixin), so
  // clear it or one test's promotion leaks into the next
  localStorage.clear()
  doBeforeEach()
})

function openVcfDisplay(adminMode = false) {
  const { rootModel } = getPluginManager(undefined, adminMode)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  view.showTrack(TRACK_ID)
  const display = view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
    .displays[0]! as unknown as PromotableDisplay
  return { rootModel, session, display }
}

test('a track following a promoted default bakes the resolved value into the shared snapshot', () => {
  const { rootModel, session, display } = openVcfDisplay()

  // sanity: no promotion yet, display resolves to promotedBase
  expect(getConfResolved(display, SLOT)).toBe('normal')

  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  expect(getConfResolved(display, SLOT)).toBe(PROMOTED)

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

test('every open display is marked ignorePromotedDefaults in the shared snapshot', () => {
  const { rootModel, session } = openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const snap = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  const views = snap.views as {
    tracks: { displays: { ignorePromotedDefaults?: boolean }[] }[]
  }[]
  const displays = views.flatMap(v => v.tracks.flatMap(t => t.displays))
  expect(displays.length).toBeGreaterThan(0)
  expect(displays.every(d => d.ignorePromotedDefaults === true)).toBe(true)
})

test('the shared snapshot reproduces the sender value in a recipient with no promoted default', () => {
  const { rootModel, session, display } = openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  expect(getConfResolved(display, SLOT)).toBe(PROMOTED)

  const shared = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  // fresh recipient: no promoted defaults of their own
  const { rootModel: recipient } = getPluginManager(undefined, false)
  recipient.setSession(shared)
  const recipientSession = recipient.session as unknown as TestSession
  const recipientDisplay = recipientSession.views[0]!.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.displays[0]! as unknown as PromotableDisplay

  expect(getConfResolved(recipientDisplay, SLOT)).toBe(PROMOTED)
})

test("a recipient's own promoted default does not repaint the received track", () => {
  const { rootModel, session, display } = openVcfDisplay()
  // sender saw the schema-resolved base value (no promotion)
  expect(getConfResolved(display, SLOT)).toBe('normal')

  const shared = bakePromotedDefaultsIntoSnapshot(
    session as never,
    getSnapshot(rootModel.session),
  )

  // recipient has promoted a DIFFERENT value; the received track must ignore it
  const { rootModel: recipient } = getPluginManager(undefined, false)
  recipient.setSession(shared)
  const recipientSession = recipient.session as unknown as TestSession
  recipientSession.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  const recipientDisplay = recipientSession.views[0]!.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.displays[0]! as unknown as PromotableDisplay

  // stays at what the sender saw, not the recipient's promoted value
  expect(getConfResolved(recipientDisplay, SLOT)).toBe('normal')
})

test('a user-added (sessionTracks) track bakes into its own config, not a delta', () => {
  // the shape a desktop self-contained export ships: the track lives in
  // sessionTracks (no admin base), so the bake writes the resolved value into
  // that config rather than a trackConfigDeltas entry
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession & {
    addTrackConf: (c: unknown) => { trackId: string } | undefined
  }
  const view = session.views[0]!

  view.showTrack(TRACK_ID)
  const base = getSnapshot(
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!.configuration,
  ) as { trackId: string; displays: { type: string; displayId: string }[] }
  const clone = structuredClone(base)
  clone.trackId += '-copy'
  for (const d of clone.displays) {
    d.displayId = `${clone.trackId}-${d.type}`
  }
  const added = session.addTrackConf(clone)!
  view.showTrack(added.trackId)

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

test('fidelity survives the real share encode/decode (long-URL round-trip)', async () => {
  const { rootModel, session, display } = openVcfDisplay()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  expect(getConfResolved(display, SLOT)).toBe(PROMOTED)

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

  const { rootModel: recipient } = getPluginManager(undefined, false)
  recipient.setSession(decoded)
  const recipientSession = recipient.session as unknown as TestSession
  const recipientDisplay = recipientSession.views[0]!.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.displays[0]! as unknown as PromotableDisplay

  expect(getConfResolved(recipientDisplay, SLOT)).toBe(PROMOTED)
})
