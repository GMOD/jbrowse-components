import { getConf } from '../../../configuration/index.ts'
import { getEnv, getSession } from '../../../util/index.ts'
import { getRpcSessionId } from '../../../util/tracks.ts'

import type { Region } from '../../../util/index.ts'
import type { StatusCallback } from '../../../util/progress.ts'
import type { StopToken } from '../../../util/stopToken.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Whether this track's adapter writes the file format itself, rather than the
 * dialog rebuilding one out of rendered features.
 *
 * A capability is a claim about the adapter type, not about a given format:
 * {@link fetchTrackData} still falls back when the adapter declines the one
 * that was asked for, which is why the answer a caller shows comes from
 * {@link TrackDataResult.usedAdapterExport} rather than from here.
 */
function trackSupportsAdapterExport(model: IAnyStateTreeNode) {
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

/**
 * What a save may pull before it asks. The adapter's own `fetchSizeLimit` where
 * it declares one, so a save does not quietly disagree with the size its own
 * display already refuses to render; otherwise this. Deliberately generous —
 * unlike the display's gate this is not a refusal, it is a confirmation, and
 * the user asked for these bytes by name.
 */
const DEFAULT_SAVE_BYTE_LIMIT = 5_000_000

function saveByteLimit(model: IAnyStateTreeNode) {
  const declared = getConf(model, ['adapter', 'fetchSizeLimit'])
  return typeof declared === 'number' && declared > 0
    ? declared
    : DEFAULT_SAVE_BYTE_LIMIT
}

/**
 * A text file ends with a newline, and deciding that once here is what keeps
 * the three adapters and seven writers from each deciding it: every one of them
 * ends in a `join('\n')`, and they disagreed — GFF3, BED and GenBank appended
 * one, VCF, SAM, bedGraph and FASTA did not. An empty export stays empty.
 */
function endWithNewline(str: string) {
  return str && !str.endsWith('\n') ? `${str}\n` : str
}

export interface TrackDataResult {
  str: string
  usedAdapterExport: boolean
  /**
   * Set, with an empty `str` and nothing downloaded, when the pre-flight
   * estimate came back over budget and the caller had not passed `force`.
   */
  tooLarge?: { bytes: number; limit: number }
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
  force,
  stopToken,
  statusCallback,
}: {
  model: IAnyStateTreeNode
  regions: Region[]
  type: string
  options: Record<string, FileTypeExporter>
  /** skip the size pre-flight — the user has seen the estimate and said yes */
  force?: boolean
  stopToken?: StopToken
  statusCallback?: StatusCallback
}): Promise<TrackDataResult> {
  const session = getSession(model)
  const sessionId = getRpcSessionId(model)
  const adapterConfig = getConf(model, ['adapter'])
  const opts = { stopToken, statusCallback }

  const supportsExport = trackSupportsAdapterExport(model)

  // The same index lookup the display's gate takes before it fetches, for the
  // same reason: this menu item pulls the region the display just refused to
  // render, and did so with no ceiling at all. An adapter quoting no estimate
  // (BigWig, sequence, HiC) answers `undefined` and nothing gates — see
  // reference/REGION_TOO_LARGE.md.
  if (!force) {
    const bytes = await session.rpcManager.call(
      sessionId,
      'CoreGetRegionByteEstimate',
      { adapterConfig, regions, ...opts },
    )
    const limit = saveByteLimit(model)
    if (bytes !== undefined && bytes > limit) {
      return {
        str: '',
        usedAdapterExport: supportsExport,
        tooLarge: { bytes, limit },
      }
    }
  }

  if (supportsExport) {
    const str = await session.rpcManager.call(sessionId, 'CoreGetExportData', {
      adapterConfig,
      regions,
      formatType: type,
      ...opts,
    })
    if (str !== undefined) {
      return { str: endWithNewline(str), usedAdapterExport: true }
    }
  }

  const feats = await session.rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    ...opts,
  })
  const str = await options[type]!.callback({
    features: feats,
    session,
    assemblyName: regions[0]!.assemblyName,
  })
  return { str: endWithNewline(str), usedAdapterExport: false }
}
