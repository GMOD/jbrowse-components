import { fullConfSnapshot } from '@jbrowse/core/configuration'
import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import { failureNotice } from '../RenderFeatureDataRPC/transcriptFeatures.ts'

import type { WorkerColor } from '../RenderFeatureDataRPC/renderConfig.ts'
import type {
  TranscriptFeatureTrackArg,
  TranscriptFeaturesArg,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearBasicDisplayConfig } from './configSchema.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

type TrackEntry = Omit<TranscriptFeatureTrackArg, 'adapter' | 'refName'>

/** The `transcriptFeatures.tracks` entries as written, with their defaults */
export function transcriptFeatureEntries(
  conf: LinearBasicDisplayConfig['transcriptFeatures'],
) {
  return (conf.tracks as AnyConfigurationModel[]).map(entry => {
    const { track, on, join, filter } = fullConfSnapshot(entry) as Omit<
      TrackEntry,
      'trackId'
    > & { track: string }
    return { trackId: track, on, join, filter } satisfies TrackEntry
  })
}

/**
 * The fills a gene glyph paints its CDS and its UTRs, which a dealt
 * `transcriptFeatures` color avoids: a row in either would vanish into the
 * exon under it. A UTR takes `utrColor`, else the solid color, else its own
 * default.
 */
export function geneFills(
  solidColor: string | undefined,
  utrColor: string | undefined,
) {
  return [
    solidColor ?? featureDefaultColor,
    utrColor === undefined || isJexl(utrColor)
      ? (solidColor ?? utrDefaultColor)
      : utrColor,
  ]
}

export interface UnplacedTranscriptFeaturesArg {
  tracks: Omit<TranscriptFeatureTrackArg, 'refName'>[]
  color: WorkerColor
}

/**
 * The worker's `transcriptFeatures` arg short of each track's contig name:
 * each entry whose track resolves to an adapter, and the share of the color
 * the worker reads. Undefined while no entry resolves.
 */
export function transcriptFeaturesArg(
  entries: (TrackEntry & { adapter?: Record<string, unknown> })[],
  color: WorkerColor,
): UnplacedTranscriptFeaturesArg | undefined {
  const tracks = entries.flatMap(({ adapter, ...entry }) =>
    adapter ? [{ ...entry, adapter }] : [],
  )
  return tracks.length > 0 ? { tracks, color } : undefined
}

/**
 * Each track's contig as its adapter spells `refName`, resolved here because a
 * worker has no aliases; or the notice for a track whose names could not be
 * read, which then draws nothing.
 */
export async function resolveTrackRefNames(
  arg: UnplacedTranscriptFeaturesArg,
  refName: string,
  refNameMap: (
    adapter: Record<string, unknown>,
  ) => Promise<Record<string, string>>,
): Promise<{ arg?: TranscriptFeaturesArg; notices: string[] }> {
  const notices: string[] = []
  const tracks = (
    await Promise.all(
      arg.tracks.map(async track => {
        try {
          const names = await refNameMap(track.adapter)
          return [{ ...track, refName: names[refName] ?? refName }]
        } catch (error) {
          notices.push(failureNotice(error))
          return []
        }
      }),
    )
  ).flat()
  return {
    arg: tracks.length > 0 ? { ...arg, tracks } : undefined,
    notices,
  }
}
