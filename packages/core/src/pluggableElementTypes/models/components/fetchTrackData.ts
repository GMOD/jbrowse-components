import { getConf } from '../../../configuration/index.ts'
import { dedupe } from '../../../util/dedupe.ts'
import { getSession } from '../../../util/index.ts'
import { getRpcSessionId } from '../../../util/tracks.ts'
import { byPosition } from '../saveTrackFileTypes/util.ts'

import type { Region } from '../../../util/index.ts'
import type { StatusCallback } from '../../../util/progress.ts'
import type { Feature } from '../../../util/simpleFeature.ts'
import type { TrackConfigModel } from '../baseTrackConfig.ts'
import type {
  ExportedFeatures,
  ExportedFeaturesRequest,
  FileTypeExporter,
} from '../saveTrackFileTypes/types.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What the export needs off the track, duck-typed rather than imported: this
 * module is behind `BaseTrackModel`'s lazy dialog import, so naming that model
 * type here would close the circle. `exportsDataViaAdapter` and
 * `exportByteLimit` are its getters; `activeDisplay` is the display drawing it,
 * whose filter decides which fetched features the file holds. A display whose
 * filter only its worker can apply answers the whole fetch itself
 * (`fetchExportedFeatures`), and `exportedFeatures` goes unread.
 */
export interface ExportableTrack extends IStateTreeNode {
  configuration: TrackConfigModel
  exportsDataViaAdapter: boolean
  exportByteLimit: number
  saveTrackFileFormatOptions: () => Record<string, FileTypeExporter>
  activeDisplay: {
    featureNoun: string
    exportedFeatures: (features: Feature[]) => Feature[]
    fetchExportedFeatures?: (
      request: ExportedFeaturesRequest,
    ) => Promise<ExportedFeatures>
  }
}

/**
 * The four fields a region fetch needs, with the fractional bounds a view hands
 * out widened to whole bases. Narrowed rather than spread whole: an LGV's
 * `visibleRegions` blocks also carry screen geometry and a `reversed` flag, and
 * `reversed` is what put a stray "[rev]" on the region the dialog says it is
 * exporting — the export itself is in reference order either way.
 *
 * Regions of one sequence that overlap or touch become one, in reference
 * order, the sequences in the order they first appear. Widening to whole bases
 * makes two neighbouring blocks share a base, and a fetch per region returned
 * a feature on that base twice.
 */
export function exportRegions(regions: Region[]): Region[] {
  const bySequence = new Map<string, Region[]>()
  for (const { assemblyName, refName, start, end } of regions) {
    const key = `${assemblyName}\t${refName}`
    const list = bySequence.get(key) ?? []
    list.push({
      assemblyName,
      refName,
      start: Math.floor(start),
      end: Math.ceil(end),
    })
    bySequence.set(key, list)
  }
  return [...bySequence.values()].flatMap(list => {
    const merged: Region[] = []
    for (const region of list.toSorted((a, b) => a.start - b.start)) {
      const last = merged.at(-1)
      if (last && region.start <= last.end) {
        last.end = Math.max(last.end, region.end)
      } else {
        merged.push({ ...region })
      }
    }
    return merged
  })
}

function fileNamePart(text: string) {
  return text.replaceAll(/[^\w.-]+/g, '_').replaceAll(/^_+|_+$/g, '')
}

/**
 * The downloaded file's name: the track, then the one region it holds
 * (`ctgA_4318-4440`, 1-based) or how many, so two saves from one session do
 * not land as `jbrowse_track_data (1).bed`.
 */
export function exportFileName({
  trackName,
  regions,
  extension,
}: {
  trackName: string
  regions: Region[]
  extension: string
}) {
  const [first] = regions
  const where =
    regions.length === 1 && first
      ? `${first.refName}_${first.start + 1}-${first.end}`
      : `${regions.length}_regions`
  const parts = [fileNamePart(trackName) || 'jbrowse_track_data', where]
  return `${parts.map(fileNamePart).join('_')}.${extension}`
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
   * The fetched features the display's filter hides, and so the file leaves
   * out. Always 0 for an adapter's own export, which writes the file's lines.
   */
  filteredOut: number
  /**
   * Set, with an empty `str` and nothing downloaded, when the pre-flight
   * estimate came back over budget and the caller had not passed `force`.
   */
  tooLarge?: { bytes: number; limit: number }
}

/**
 * The features in `regions` the display keeps, for a display whose filter
 * reads the fetched features themselves (`exportedFeatures`).
 */
async function fetchedThenFiltered({
  model,
  regions,
  adapterConfig,
  signal,
  statusCallback,
}: {
  model: ExportableTrack
  regions: Region[]
  adapterConfig: Record<string, unknown>
  signal?: AbortSignal
  statusCallback?: StatusCallback
}): Promise<ExportedFeatures> {
  // A feature crossing from one region into the next comes back once per
  // region; a collapsed-introns view is one region per exon of the same gene.
  const fetched = dedupe(
    await getSession(model).rpcManager.call(
      getRpcSessionId(model),
      'CoreGetFeatures',
      { adapterConfig, regions, signal, statusCallback },
    ),
    f => f.id(),
  )
  const features = model.activeDisplay.exportedFeatures(fetched)
  return { features, filteredOut: fetched.length - features.length }
}

/**
 * The data behind the "Save track data" dialog, in the selected format.
 *
 * This reads every feature in the visible region, which on a deep track is the
 * same work the display itself does — worth cancelling when the dialog closes,
 * and worth naming while it runs, hence the signal and status callback.
 */
export async function fetchTrackData({
  model,
  regions,
  type,
  options,
  force,
  signal,
  statusCallback,
}: {
  model: ExportableTrack
  regions: Region[]
  type: string
  options: Record<string, FileTypeExporter>
  /** skip the size pre-flight — the user has seen the estimate and said yes */
  force?: boolean
  signal?: AbortSignal
  statusCallback?: StatusCallback
}): Promise<TrackDataResult> {
  const session = getSession(model)
  const sessionId = getRpcSessionId(model)
  const adapterConfig = getConf(model, ['adapter'])
  const opts = { signal, statusCallback }
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
      // a save downloads every region in one file, so the total is what the
      // user approves — unlike the gate, whose budget is per-region
      { adapterConfig, regions, scope: 'wholeRequest', ...opts },
    )
    const limit = model.exportByteLimit
    if (bytes !== undefined && bytes > limit) {
      return {
        str: '',
        usedAdapterExport: exportsDataViaAdapter,
        filteredOut: 0,
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
      return {
        str: endWithNewline(str),
        usedAdapterExport: true,
        filteredOut: 0,
      }
    }
  }

  const exporter = options[type]!
  const display = model.activeDisplay
  const { features, filteredOut } = display.fetchExportedFeatures
    ? await display.fetchExportedFeatures({
        regions,
        featureSet: exporter.featureSet ?? 'drawn',
        ...opts,
      })
    : await fetchedThenFiltered({
        model,
        regions,
        adapterConfig,
        ...opts,
      })
  // Empty rather than a header with no records under it, so the dialog can
  // say the region holds nothing instead of offering that file for download.
  const str = features.length
    ? await exporter.callback({
        features: byPosition(features),
        session,
        assemblyName: regions[0]!.assemblyName,
        regions,
        ...opts,
      })
    : ''
  return {
    str: endWithNewline(str),
    usedAdapterExport: false,
    filteredOut,
  }
}
