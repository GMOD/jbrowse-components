import { getConf } from '../../../configuration/index.ts'
import { getEnv, getSession } from '../../../util/index.ts'
import { getRpcSessionId } from '../../../util/tracks.ts'

import type { Feature, Region } from '../../../util/index.ts'
import type { StatusCallback } from '../../../util/progress.ts'
import type { StopToken } from '../../../util/stopToken.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Whether this track's adapter writes the file format itself, rather than the
 * dialog rebuilding one out of rendered features. Answerable without a fetch,
 * so the dialog can say which of the two the user is getting while the fetch is
 * still running, and can keep the format out of its fetch key on the feature
 * path — where every format reads the same features.
 *
 * A capability is a claim about the adapter type, not about a given format:
 * {@link fetchTrackData} still falls back when the adapter declines the one
 * that was asked for.
 */
export function trackSupportsAdapterExport(model: IAnyStateTreeNode) {
  const { pluginManager } = getEnv(model)
  const adapterConfig = getConf(model, ['adapter'])
  return pluginManager
    .getAdapterType(adapterConfig.type)
    .adapterCapabilities.includes('exportData')
}

export function roundRegions(regions: Region[]) {
  return regions.map(r => ({
    ...r,
    start: Math.floor(r.start),
    end: Math.ceil(r.end),
  }))
}

export interface TrackDataResult {
  str: string
  /**
   * The features the string was written from, when the dialog rebuilt it. The
   * caller holds onto them so switching format re-runs the writer instead of
   * re-reading the region — see the `features` input.
   */
  features?: Feature[]
  usedAdapterExport: boolean
}

/**
 * The data behind the "Save track data" dialog, in the selected format.
 *
 * This reads every feature in the visible region, which on a deep track is the
 * same work the display itself does — worth cancelling when the dialog closes,
 * and worth naming while it runs, hence the stop token and status callback.
 */
export async function fetchTrackData({
  model,
  regions,
  type,
  options,
  features,
  stopToken,
  statusCallback,
}: {
  model: IAnyStateTreeNode
  regions: Region[]
  type: string
  options: Record<string, FileTypeExporter>
  /** already-read features for these regions, if the caller kept them */
  features?: Feature[]
  stopToken?: StopToken
  statusCallback?: StatusCallback
}): Promise<TrackDataResult> {
  const session = getSession(model)
  const sessionId = getRpcSessionId(model)
  const adapterConfig = getConf(model, ['adapter'])
  const opts = { stopToken, statusCallback }

  const supportsExport = trackSupportsAdapterExport(model)
  if (supportsExport) {
    const str = await session.rpcManager.call(sessionId, 'CoreGetExportData', {
      adapterConfig,
      regions,
      formatType: type,
      ...opts,
    })
    if (str !== undefined) {
      return { str, usedAdapterExport: true }
    }
  }

  // Reaching here means no raw lines for this format, whatever the adapter
  // declares — the attempt above is unconditional, so "the next format may be
  // one it does write" is already answered and cannot be a reason to re-read.
  // The features are the same features either way: CoreGetFeatures takes no
  // format, so what a declined format read is what the next declined one wants.
  const feats =
    features ??
    (await session.rpcManager.call(sessionId, 'CoreGetFeatures', {
      adapterConfig,
      regions,
      ...opts,
    }))
  const str = await options[type]!.callback({
    features: feats,
    session,
    assemblyName: regions[0]!.assemblyName,
  })
  return { str, features: feats, usedAdapterExport: false }
}
