import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import {
  canonicalDisplayType,
  defaultDisplay,
  lookupTrack,
  viewTrackEntries,
} from './configs.ts'
import { specDisplayType } from './decode.ts'

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

// `displayDefaults` where the track opens as the figure's display anyway, a
// `displays` entry where declaring it is what makes the track open as it, and
// nothing where neither holds
function withSettings(
  track: RawTrack,
  info: TrackInfo,
  viewType: string,
  display: string,
  settings: Record<string, unknown>,
): RawTrack | undefined {
  const displays = (track.displays ?? []) as Record<string, unknown>[]
  if (displays.some(d => d.type === display)) {
    return {
      ...track,
      displays: displays.map(d =>
        d.type === display ? { ...d, ...settings } : d,
      ),
    }
  }
  if (defaultDisplay(info, viewType) === display) {
    return {
      ...track,
      displayDefaults: {
        ...(isRecord(track.displayDefaults) ? track.displayDefaults : {}),
        ...settings,
      },
    }
  }
  const declared = { ...info, declaredDisplayTypes: [display] }
  return defaultDisplay(declared, viewType) === display
    ? { ...track, displays: [...displays, { type: display, ...settings }] }
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
// track the spec sets slots on, as a template whose `uri` the reader fills in.
export function configTracks({ config, spec }: DecodedSpec): RawTrack[] {
  const sessionTracks = (spec.sessionTracks ?? []) as RawTrack[]
  const tracks = new Map(sessionTracks.map(track => [track.trackId, track]))
  const assemblies = [...new Set(viewAssemblies(spec.views))]
  for (const { entry, viewType } of viewTrackEntries(spec.views)) {
    const info =
      typeof entry === 'string' || !viewType
        ? undefined
        : lookupTrack(config, entry.trackId, sessionTracks)
    const display =
      info && typeof entry !== 'string'
        ? canonicalDisplayType(specDisplayType(entry)) ??
          defaultDisplay(info, viewType!)
        : undefined
    const settings =
      display && typeof entry !== 'string' ? slotSettings(entry, display) : {}
    if (!info || !display || Object.keys(settings).length === 0) {
      continue
    }
    const assemblyNames =
      info.assemblyNames ?? (assemblies.length === 1 ? assemblies : undefined)
    const adapter = ownAdapter(info)
    const base: RawTrack | undefined =
      tracks.get(info.trackId) ??
      (assemblyNames && adapter
        ? {
            type: info.type,
            trackId: info.trackId,
            name: info.name,
            assemblyNames,
            adapter,
          }
        : undefined)
    const styled =
      base && withSettings(base, info, viewType!, display, settings)
    if (styled) {
      tracks.set(info.trackId, styled)
    }
  }
  return [...tracks.values()]
}
