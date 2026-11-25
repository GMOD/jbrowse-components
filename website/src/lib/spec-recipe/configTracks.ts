import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import {
  canonicalDisplayType,
  defaultDisplay,
  lookupRawTrack,
  lookupTrack,
  opensAs,
  ownDisplayConfig,
  viewTrackEntries,
} from './configs.ts'
import { specDisplayType, specTrackSettings } from './decode.ts'

import type { RawTrack, TrackInfo } from './configs.ts'
import type { DecodedSpec, SpecTrack, SpecView } from './decode.ts'

// Stands in for the reader's own file in a track the figure takes from its
// config, whose own file is the hosted one.
export const OWN_FILE = 'YOUR_FILE'

// The settings a spec puts on a track that are slots of the display it opens
// as. Clustering, highlights and other view state have no slot and stay in the
// session.
function slotSettings(entry: SpecTrack, display: string) {
  const { trackId, type, pane, displaySnapshot, ...inline } = entry
  const slots = new Set(
    configManifest.displays[display]?.slots.map(slot => slot.name),
  )
  slots.delete('type')
  slots.delete('displayId')
  return Object.fromEntries(
    Object.entries({
      ...inline,
      ...(isRecord(displaySnapshot) ? displaySnapshot : {}),
    }).filter(([key]) => slots.has(key)),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// `displayDefaults` where the track opens as the figure's display anyway, the
// figure's display moved first where that makes the track open as it, and
// nothing where neither holds
function withSettings(
  track: RawTrack,
  info: TrackInfo,
  viewType: string,
  display: string,
  settings: Record<string, unknown>,
): RawTrack | undefined {
  const displays = track.displays ?? []
  const isDisplay = (d: { type?: string }) =>
    canonicalDisplayType(d.type) === display
  const declared = displays.find(isDisplay)
  const first = [
    { ...declared, type: display, ...settings },
    ...displays.filter(d => !isDisplay(d)),
  ]
  return opensAs(info, viewType, displays) === display
    ? declared
      ? {
          ...track,
          displays: displays.map(d => (isDisplay(d) ? { ...d, ...settings } : d)),
        }
      : {
          ...track,
          displayDefaults: {
            ...(isRecord(track.displayDefaults) ? track.displayDefaults : {}),
            ...settings,
          },
        }
    : opensAs(info, viewType, first) === display
      ? { ...track, displays: first }
      : undefined
}

// The adapter a reader fills in with their own files: one `uri`, or a
// BigWig per row of a multi-wiggle. A sequence track gets none, since its file
// belongs to the assembly.
function ownAdapter({ type, adapterType }: TrackInfo) {
  return type === 'ReferenceSequenceTrack'
    ? undefined
    : adapterType === 'MultiWiggleAdapter'
      ? { type: adapterType, bigWigs: [`${OWN_FILE}_1`, `${OWN_FILE}_2`] }
      : configManifest.adapters[adapterType]?.shorthandKeys?.includes('uri')
        ? { type: adapterType, uri: OWN_FILE }
        : undefined
}

function viewAssemblies(views: SpecView[] = []): string[] {
  return views.flatMap(view => [
    ...(view.assembly ? [view.assembly] : []),
    ...viewAssemblies(view.views),
  ])
}

// The figure's tracks as a config.json would hold them, each carrying the
// display settings that make the figure: its session tracks, and every config
// track that has display config of its own or that the spec sets slots on, as
// a template whose `uri` the reader fills in. `missing` names the styled
// tracks no template can be written for: a sequence track, or a track or
// adapter type from a plugin, whose slots this generator cannot read.
export function rebuildTracks({ config, spec }: DecodedSpec) {
  const sessionTracks = (spec.sessionTracks ?? []) as RawTrack[]
  const tracks = new Map(sessionTracks.map(track => [track.trackId, track]))
  const missing = new Map<string, string>()
  const assemblies = [...new Set(viewAssemblies(spec.views))]
  for (const { entry, viewType } of viewTrackEntries(spec.views)) {
    const trackId = typeof entry === 'string' ? entry : entry.trackId
    const info = lookupTrack(config, trackId, sessionTracks)
    const display =
      info && viewType
        ? (canonicalDisplayType(specDisplayType(entry)) ??
          defaultDisplay(info, viewType))
        : undefined
    const settings =
      display && typeof entry !== 'string' ? slotSettings(entry, display) : {}
    const raw = lookupRawTrack(config, trackId)
    const own = raw ? ownDisplayConfig(raw, info, viewType) : {}
    const assemblyNames =
      info?.assemblyNames ?? (assemblies.length === 1 ? assemblies : undefined)
    const adapter = info ? ownAdapter(info) : undefined
    const base: RawTrack | undefined =
      tracks.get(trackId) ??
      (info && assemblyNames && adapter
        ? {
            type: info.type,
            trackId,
            name: info.name,
            assemblyNames,
            adapter,
            ...own,
          }
        : undefined)
    const styled =
      base && info && viewType && display && Object.keys(settings).length
        ? withSettings(base, info, viewType, display, settings)
        : undefined
    const kept = Object.keys(settings).length
      ? styled
      : Object.keys(own).length
        ? base
        : undefined
    const unreadDisplay = !display || !(display in configManifest.displays)
    const styledInFigure =
      Object.keys(own).length > 0 ||
      (unreadDisplay
        ? specTrackSettings(entry).length > 0
        : Object.keys(settings).length > 0)
    if (kept) {
      tracks.set(trackId, kept)
    } else if (styledInFigure && !tracks.has(trackId)) {
      missing.set(trackId, info?.name ?? trackId)
    }
  }
  return {
    tracks: [...tracks.values()],
    missing: [...missing].flatMap(([trackId, name]) =>
      tracks.has(trackId) ? [] : [name],
    ),
  }
}

export function configTracks(decoded: DecodedSpec): RawTrack[] {
  return rebuildTracks(decoded).tracks
}
