import { adapterNeedsAddTrackComponent, getEnv } from '@jbrowse/core/util'
import {
  UNKNOWN,
  getFileName,
  guessAdapter,
  guessTrackType,
  localIndexNeed,
} from '@jbrowse/core/util/tracks'

import { locationId } from './pairLocations.ts'

import type { LocationPair } from './pairLocations.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * `needsSetup` is a format whose add-track form contributes config a filename
 * cannot: a synteny file needs its assembly pair, and a config built without one
 * is added to the session and then never offered in the view it was made for.
 * Guessing gets no closer, so the row is shown and excluded rather than added
 * broken. `needsIndex` is a file picked from this computer whose format cannot
 * be read without the index it was not paired with.
 */
export type TrackStatus = 'ok' | 'unknown' | 'needsSetup' | 'needsIndex'

export interface TrackConfRow {
  id: string
  /**
   * The config minus its trackId, which is minted at submit time from the name
   * the row is actually added under (see `submitBulkTracks`).
   */
  conf: {
    type: string
    name: string
    assemblyNames: string[]
    adapter: Record<string, unknown>
  }
  name: string
  trackType: string
  adapterType: string
  /** display name of the paired index, if any */
  indexName?: string
  /** location id of the paired index, so removing a row also removes its index */
  indexId?: string
  status: TrackStatus
}

function statusOf(
  adapterType: string,
  pair: LocationPair,
  pluginManager: PluginManager,
): TrackStatus {
  if (adapterType === UNKNOWN) {
    return 'unknown'
  }
  const need = localIndexNeed(pair.file, pair.index)
  return adapterNeedsAddTrackComponent(pluginManager, adapterType)
    ? 'needsSetup'
    : need?.kind === 'required' && need.adapterType === adapterType
      ? 'needsIndex'
      : 'ok'
}

/**
 * Builds a preview track config for each data/index pair using the same
 * `guessAdapter` / `guessTrackType` extension points the single-track workflow
 * uses, so every installed format plugin is supported automatically.
 */
export function buildTrackConfigs({
  pairs,
  model,
  assembly,
}: {
  pairs: LocationPair[]
  model: IAnyStateTreeNode
  assembly: string
}): TrackConfRow[] {
  const { pluginManager } = getEnv(model)
  return pairs.map(pair => {
    const adapter = guessAdapter(pair.file, pair.index, '', model)
    const adapterType = adapter.type
    const trackType = guessTrackType(adapterType, model, pair.file)
    const name = getFileName(pair.file)
    return {
      id: locationId(pair.file),
      conf: {
        type: trackType,
        name,
        assemblyNames: [assembly],
        adapter,
      },
      name,
      trackType,
      adapterType,
      indexName: pair.index ? getFileName(pair.index) : undefined,
      indexId: pair.index ? locationId(pair.index) : undefined,
      status: statusOf(adapterType, pair, pluginManager),
    }
  })
}
