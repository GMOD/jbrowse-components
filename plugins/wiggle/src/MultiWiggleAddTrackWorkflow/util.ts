import {
  addAndShowTrack,
  fileToLocation,
  getEnv,
  makeTrackId,
} from '@jbrowse/core/util'
import { guessAdapter, guessTrackType } from '@jbrowse/core/util/tracks'

import {
  adapterSpec,
  getFilenameFromAdapterConfig,
} from '../MultiWiggleAdapter/memberLocation.ts'
import { getFilename } from '../util.ts'

import type { MemberConfig } from '../MultiWiggleAdapter/memberLocation.ts'
import type { SessionWithAddSessionTrack } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export type TrackItem = string | Record<string, unknown>

export type StackKind = 'quantitative' | 'feature'

export interface Member {
  name: string
  conf: MemberConfig
  kind: StackKind
}

export interface Refusal {
  name: string
  reason: string
}

export interface Guessers {
  guessAdapter: (location: FileLocation) => MemberConfig
  guessTrackType: (adapterType: string, location?: FileLocation) => string
  hasAdapterType: (adapterType: string) => boolean
}

export function sessionGuessers(model: IStateTreeNode): Guessers {
  const { pluginManager } = getEnv(model)
  return {
    guessAdapter: location =>
      guessAdapter(location, undefined, undefined, model),
    guessTrackType: (adapterType, location) =>
      guessTrackType(adapterType, model, location),
    hasAdapterType: adapterType => pluginManager.hasAdapterType(adapterType),
  }
}

function lineSplit(val: string) {
  return val
    .split(/[\r\n]+/)
    .map(f => f.trim())
    .filter(Boolean)
}

export function parseItems(val: string): TrackItem[] {
  try {
    const parsed: unknown = JSON.parse(val)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is TrackItem =>
          typeof item === 'string' ||
          (typeof item === 'object' && item !== null),
      )
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return [parsed as Record<string, unknown>]
    }
  } catch {}
  return lineSplit(val)
}

export function stackKindOf(trackType: string): StackKind | undefined {
  return trackType === 'QuantitativeTrack'
    ? 'quantitative'
    : trackType === 'FeatureTrack'
      ? 'feature'
      : undefined
}

function isBlob(location: FileLocation) {
  return !('uri' in location) && !('localPath' in location)
}

function needsSidecar(adapterType: string) {
  const kind = adapterSpec(adapterType)?.kind
  return kind === 'indexed' || kind === 'sidecar'
}

function member(
  name: string,
  conf: MemberConfig & { type: string },
  trackType: string,
): Member | Refusal {
  const kind = stackKindOf(trackType)
  return kind
    ? { name, conf, kind }
    : { name, reason: `${trackType} data does not stack into rows` }
}

function classifyLocation(
  location: FileLocation,
  name: string,
  guessers: Guessers,
  extra: Record<string, unknown> = {},
) {
  const conf = guessers.guessAdapter(location)
  const { type } = conf
  if (!type || !guessers.hasAdapterType(type)) {
    return { name, reason: 'not a file format JBrowse recognizes' }
  } else if (isBlob(location) && needsSidecar(type)) {
    return {
      name,
      reason: 'needs its index beside it; paste the file URL instead',
    }
  } else {
    return member(
      name,
      { ...conf, type, ...extra },
      guessers.guessTrackType(type, location),
    )
  }
}

export function itemToName(item: TrackItem) {
  return typeof item === 'string'
    ? getFilename(item)
    : `${item.source ?? item.name ?? getFilenameFromAdapterConfig(item) ?? 'unnamed'}`
}

export function classifyItem(item: TrackItem, guessers: Guessers) {
  const name = itemToName(item)
  if (typeof item === 'string') {
    return classifyLocation(
      { uri: item, locationType: 'UriLocation' },
      name,
      guessers,
    )
  }
  const { type } = item
  return typeof type === 'string' && guessers.hasAdapterType(type)
    ? member(name, { ...item, type }, guessers.guessTrackType(type))
    : { name, reason: `unknown adapter type "${type}"` }
}

// A dropped file pins its name as `source`, since a blob location carries no
// path for the adapter to derive one from once the session reloads.
export function classifyFile(file: File, guessers: Guessers) {
  const name = getFilename(file.name)
  return classifyLocation(fileToLocation(file), name, guessers, {
    source: name,
  })
}

export function partition(classified: (Member | Refusal)[]) {
  const members: Member[] = []
  const refusals: Refusal[] = []
  for (const c of classified) {
    if ('reason' in c) {
      refusals.push(c)
    } else {
      members.push(c)
    }
  }
  return { members, refusals }
}

export function stackKind(kinds: StackKind[]) {
  const distinct = new Set(kinds)
  return distinct.size > 1 ? 'mixed' : kinds[0]
}

export const MIXED_MESSAGE =
  'Quantitative and feature data do not stack together; remove one kind'

export function applyName({ name, conf }: Member, newName: string) {
  return newName === name ? conf : { ...conf, source: newName }
}

export function canSubmit({
  kind,
  trackName,
  assembly,
}: {
  kind: StackKind | 'mixed' | undefined
  trackName: string
  assembly: string | undefined
}) {
  return (
    kind !== undefined &&
    kind !== 'mixed' &&
    trackName.trim().length > 0 &&
    !!assembly
  )
}

function bareBigWigUri(conf: MemberConfig) {
  const loc = conf.bigWigLocation as Record<string, unknown> | undefined
  return conf.type === 'BigWigAdapter' &&
    Object.keys(conf).length === 2 &&
    loc &&
    typeof loc.uri === 'string' &&
    Object.keys(loc).every(k => k === 'uri' || k === 'locationType') &&
    (loc.locationType ?? 'UriLocation') === 'UriLocation'
    ? loc.uri
    : undefined
}

export function buildAdapterPayload(confs: MemberConfig[]) {
  const uris = confs.map(bareBigWigUri)
  return uris.every(uri => uri !== undefined)
    ? { bigWigs: uris }
    : { subadapters: confs }
}

/**
 * A stack of files as one track: quantitative files as a
 * MultiQuantitativeTrack, feature files as a FeatureTrack painting one row per
 * file. Shared by the add-track workflow and the track selector's "Create
 * multi-row track".
 */
export function buildMultiRowTrackConf({
  name,
  assemblyNames,
  adapter,
  kind,
}: {
  name: string
  assemblyNames: string[]
  adapter: Record<string, unknown>
  kind: StackKind
}) {
  const trackId = makeTrackId({ name })
  const base = {
    trackId,
    name,
    assemblyNames,
    adapter: { type: 'MultiWiggleAdapter', ...adapter },
  }
  return kind === 'quantitative'
    ? { ...base, type: 'MultiQuantitativeTrack' }
    : {
        ...base,
        type: 'FeatureTrack',
        displays: [
          {
            type: 'LinearMultiRowFeatureDisplay',
            displayId: `${trackId}-LinearMultiRowFeatureDisplay`,
            rows: 'source',
          },
        ],
      }
}

export function addMultiRowTrack({
  session,
  view,
  ...rest
}: {
  session: SessionWithAddSessionTrack
  view?: { launchTrack: (trackId: string) => Promise<unknown> }
  name: string
  assemblyNames: string[]
  adapter: Record<string, unknown>
  kind: StackKind
}) {
  addAndShowTrack(session, buildMultiRowTrackConf(rest), view)
}
