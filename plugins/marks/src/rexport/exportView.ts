import { alignmentsPanels } from './alignmentsToR.ts'
import { featureFields, featurePlot } from './featureToPlot.ts'
import {
  READERS,
  frameFor,
  isReadable,
  sourceNotes,
  uriOf,
} from './frameFor.ts'
import { fieldsRead, markPlot } from './markToPlot.ts'
import { assembleRScript } from './rScript.ts'

import type { FeatureDisplaySpec } from './featureToPlot.ts'
import type { ReaderName } from './frameFor.ts'
import type { DisplaySpec } from './markToPlot.ts'
import type { Panel, Region } from './rScript.ts'

export interface RExportTrack {
  trackId: string
  trackName: string
  displayType: string
  adapter: Record<string, unknown>
  display: Record<string, unknown>
  /** The assembly's FASTA or 2bit, for a read with no MD tag. */
  reference?: string
  /** Canonical refName to the name the track's file spells it with, where they differ. */
  refNames?: Record<string, string>
}

export interface RExportPanels {
  panels: Panel[]
  notes: string[]
}

export interface RExportSkipped {
  skipped: string
}

export type RExporter = (
  track: RExportTrack,
  regions: readonly Region[],
) => RExportPanels | RExportSkipped

export function rKey(trackId: string) {
  return trackId.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(?=[\d_])/, 'x')
}

function locate(
  track: RExportTrack,
  accepted: readonly string[],
): RExportSkipped | { type: ReaderName; uri: string } {
  const type = String(track.adapter.type)
  if (!accepted.includes(type) || !isReadable(type)) {
    return { skipped: `${type} has no R reader for this display` }
  }
  const uri = uriOf(track.adapter, READERS[type].location)
  if (!uri) {
    return { skipped: `${type} names no file` }
  }
  return uri.startsWith('blob:')
    ? { skipped: 'it reads a file opened in the browser, which R cannot reach' }
    : { type, uri }
}

const markExporter: RExporter = (track, regions) => {
  const located = locate(track, Object.keys(READERS))
  if ('skipped' in located) {
    return located
  }
  const { type, uri } = located
  const key = rKey(track.trackId)
  const display = track.display as unknown as DisplaySpec
  const base = frameFor({
    type,
    uri,
    name: `df_${key}`,
    aliases: track.refNames,
    fields: fieldsRead(display),
  })
  const { plot, notes } = markPlot({ display, frame: base, regions })
  return {
    panels: [{ variable: `p_${key}`, plot }],
    notes: [...sourceNotes(uri), ...notes],
  }
}

const featureExporter: RExporter = (track, regions) => {
  const located = locate(track, ['Gff3TabixAdapter', 'BedTabixAdapter'])
  if ('skipped' in located) {
    return located
  }
  const { type, uri } = located
  const key = rKey(track.trackId)
  const display = track.display as unknown as FeatureDisplaySpec
  const base = frameFor({
    type,
    uri,
    name: `genes_${key}`,
    aliases: track.refNames,
    fields: featureFields(display, regions),
    wholeFeatures: true,
  })
  const { plot, notes } = featurePlot({ display, frame: base, regions })
  return {
    panels: [{ variable: `p_${key}`, plot }],
    notes: [...sourceNotes(uri), ...notes],
  }
}

const alignmentsExporter: RExporter = (track, regions) => {
  const located = locate(track, ['BamAdapter'])
  if ('skipped' in located) {
    return located
  }
  const { uri } = located
  const { panels, notes } = alignmentsPanels({
    display: track.display,
    uri,
    regions,
    reference: track.reference,
    aliases: track.refNames,
    key: rKey(track.trackId),
  })
  return { panels, notes: [...sourceNotes(uri), ...notes] }
}

export const BUILTIN_EXPORTERS: Record<string, RExporter> = {
  LinearMarkDisplay: markExporter,
  LinearBasicDisplay: featureExporter,
  LinearAlignmentsDisplay: alignmentsExporter,
}

/**
 * One script for a set of tracks over the regions on screen. A track no
 * exporter reads, or one that throws, lands in the header as a note instead of
 * stopping the figure: a script that quietly differs from its view says so.
 */
export function exportTracksToR({
  tracks,
  regions,
  exporters = BUILTIN_EXPORTERS,
  out,
}: {
  tracks: readonly RExportTrack[]
  regions: readonly Region[]
  exporters?: Record<string, RExporter>
  out?: string
}) {
  const panels: Panel[] = []
  const notes: string[] = []
  for (const track of tracks) {
    const exporter = exporters[track.displayType]
    if (!exporter) {
      notes.push(`${track.trackName}: ${track.displayType} has no R export`)
      continue
    }
    try {
      const result = exporter(track, regions)
      if ('skipped' in result) {
        notes.push(`${track.trackName}: ${result.skipped}`)
        continue
      }
      panels.push(...result.panels)
      notes.push(...result.notes.map(n => `${track.trackName}: ${n}`))
    } catch (e) {
      notes.push(
        `${track.trackName}: skipped, ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }
  return {
    drawn: panels.length,
    script: panels.length
      ? assembleRScript({ regions, panels, notes, out })
      : undefined,
    notes,
  }
}
