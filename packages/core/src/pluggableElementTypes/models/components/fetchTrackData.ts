import { getConf } from '../../../configuration/index.ts'
import { getSession } from '../../../util/index.ts'
import { getRpcSessionId } from '../../../util/tracks.ts'

import type { AnyConfigurationModel } from '../../../configuration/index.ts'
import type { Region } from '../../../util/index.ts'
import type { StatusCallback } from '../../../util/progress.ts'
import type { StopToken } from '../../../util/stopToken.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the export needs off the track, duck-typed rather than imported: this
 * module is behind `BaseTrackModel`'s lazy dialog import, so naming that model
 * type here would close the circle. `exportsDataViaAdapter` and
 * `exportByteLimit` are its getters.
 */
export interface ExportableTrack extends IStateTreeNode {
  configuration: AnyConfigurationModel
  exportsDataViaAdapter: boolean
  exportByteLimit: number
  saveTrackFileFormatOptions: () => Record<string, FileTypeExporter>
}

/**
 * The four fields a region fetch needs, with the fractional bounds a view hands
 * out widened to whole bases. Narrowed rather than spread whole: an LGV's
 * `visibleRegions` blocks also carry screen geometry and a `reversed` flag, and
 * `reversed` is what put a stray "[rev]" on the region the dialog says it is
 * exporting — the export itself is in reference order either way.
 */
export function roundRegions(regions: Region[]): Region[] {
  return regions.map(({ assemblyName, refName, start, end }) => ({
    assemblyName,
    refName,
    start: Math.floor(start),
    end: Math.ceil(end),
  }))
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
  model: ExportableTrack
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
  const { exportsDataViaAdapter } = model

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
    const limit = model.exportByteLimit
    if (bytes !== undefined && bytes > limit) {
      return {
        str: '',
        usedAdapterExport: exportsDataViaAdapter,
        tooLarge: { bytes, limit },
      }
    }
  }

  if (exportsDataViaAdapter) {
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
    ...opts,
  })
  return { str: endWithNewline(str), usedAdapterExport: false }
}
