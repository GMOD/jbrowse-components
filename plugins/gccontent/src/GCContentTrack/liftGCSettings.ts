import type PluginManager from '@jbrowse/core/PluginManager'

/** What the retired GC content display held, which the adapter computes from. */
export const GC_SETTINGS = ['windowSize', 'windowDelta', 'gcMode'] as const

type Snapshot = Record<string, unknown>

interface TrackConfigSnapshot {
  displays?: Snapshot[]
  [key: string]: unknown
}

const isRecord = (v: unknown): v is Snapshot =>
  !!v && typeof v === 'object' && !Array.isArray(v)

function pick(from: Snapshot | undefined) {
  return Object.fromEntries(
    GC_SETTINGS.filter(k => from?.[k] !== undefined).map(k => [k, from![k]]),
  )
}

function omit(from: Snapshot) {
  return Object.fromEntries(
    Object.entries(from).filter(
      ([k]) => !(GC_SETTINGS as readonly string[]).includes(k),
    ),
  )
}

/**
 * A track config with the GC settings v4 spelt on its display moved onto the
 * adapter that computes them. On a `GCContentTrack` the retired display's
 * entry, now the wiggle display's, and `displayDefaults` each give theirs up,
 * the display's winning as it did when it drew, and a bare sequence adapter is
 * wrapped in the `GCContentAdapter` the display used to wrap it in. A reference
 * sequence track's retired GC display is dropped: GC content is a track of its
 * own, which its menu's "Add GC content track" makes.
 */
export function liftGCSettings(snap: TrackConfigSnapshot): TrackConfigSnapshot {
  const displays = Array.isArray(snap.displays) ? snap.displays : []
  if (snap.type === 'ReferenceSequenceTrack') {
    return displays.some(d => d.type === 'LinearWiggleDisplay')
      ? {
          ...snap,
          displays: displays.filter(d => d.type !== 'LinearWiggleDisplay'),
        }
      : snap
  }
  if (snap.type !== 'GCContentTrack') {
    return snap
  }
  const defaults = isRecord(snap.displayDefaults)
    ? snap.displayDefaults
    : undefined
  const written = {
    ...pick(defaults),
    ...Object.assign({}, ...displays.map(d => pick(d))),
  }
  const adapter = isRecord(snap.adapter) ? snap.adapter : undefined
  const needsWrap = adapter !== undefined && adapter.type !== 'GCContentAdapter'
  if (Object.keys(written).length === 0 && !needsWrap) {
    return snap
  }
  const gcAdapter = needsWrap
    ? { type: 'GCContentAdapter', sequenceAdapter: adapter }
    : (adapter ?? { type: 'GCContentAdapter' })
  return {
    ...snap,
    adapter: { ...gcAdapter, ...written },
    ...(defaults ? { displayDefaults: omit(defaults) } : {}),
    displays: displays.map(d => omit(d)),
  }
}

export default function LiftGCSettingsF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-preProcessTrackConfig',
    liftGCSettings,
  )
}
