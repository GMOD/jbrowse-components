import { DEFAULT_MARK_TYPE } from '../LinearMarkDisplay/markVocabulary.ts'
import { alignmentsPanels } from './alignmentsToR.ts'
import {
  displayArg,
  engineDisplay,
  engineResult,
  engineSource,
  featurePanel,
  readerCall,
  wigglePanel,
  zoomOf,
} from './engineToR.ts'
import {
  READERS,
  frameFor,
  isReadable,
  locationPath,
  sourceNotes,
  uriOf,
} from './frameFor.ts'
import { fieldsRead, markPlot } from './markToPlot.ts'
import { assembleRScript } from './rScript.ts'
import { rStr } from './rplot.ts'

import type { MarkType } from '../LinearMarkDisplay/markVocabulary.ts'
import type { ReaderName } from './frameFor.ts'
import type { DisplaySpec, MarkConfig } from './markToPlot.ts'
import type { Panel, Region } from './rScript.ts'

export interface RExportTrack {
  trackId: string
  trackName: string
  displayType: string
  adapter: Record<string, unknown>
  display: Record<string, unknown>
  /** `display` as written, its defaults left out, where `display` is the resolved config. */
  writtenDisplay?: Record<string, unknown>
  /** The assembly's FASTA or 2bit, for a read with no MD tag. */
  reference?: string
  /** Canonical refName to the name the track's file spells it with, where they differ. */
  refNames?: Record<string, string>
  /** The view's zoom, which gates a mark that draws only in a bp/px range. */
  viewBpPerPx?: number
}

export interface RExportPanels {
  panels: Panel[]
  notes: string[]
}

export interface RExportSkipped {
  skipped: string
}

export interface KeyedTrack extends RExportTrack {
  /** An R-safe name, unique within the script, that suffixes this track's bindings. */
  key: string
}

export type RExporter = (
  track: KeyedTrack,
  regions: readonly Region[],
) => RExportPanels | RExportSkipped

export function rKey(trackId: string) {
  return trackId.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(?=[\d_])/, 'x')
}

function keyed(tracks: readonly RExportTrack[]): KeyedTrack[] {
  const taken = new Set<string>()
  return tracks.map(track => {
    const base = rKey(track.trackId)
    let key = base
    for (let n = 2; taken.has(key); n++) {
      key = `${base}_${n}`
    }
    taken.add(key)
    return { ...track, key }
  })
}

function locate(
  track: RExportTrack,
  accepted: readonly string[],
): RExportSkipped | { type: ReaderName; uri: string; index?: string } {
  const type = String(track.adapter.type)
  if (!accepted.includes(type) || !isReadable(type)) {
    return { skipped: `${type} has no R reader for this display` }
  }
  const uri = uriOf(track.adapter, READERS[type].location)
  if (!uri) {
    return { skipped: `${type} names no file` }
  }
  if (uri.startsWith('blob:')) {
    return {
      skipped: 'it reads a file opened in the browser, which R cannot reach',
    }
  }
  const declared = locationPath(
    (track.adapter.index as { location?: unknown } | undefined)?.location,
  )
  const beside = `${uri}${type === 'BamAdapter' ? '.bai' : '.tbi'}`
  return {
    type,
    uri,
    index:
      type === 'BamAdapter'
        ? (declared ?? beside)
        : declared !== beside
          ? declared
          : undefined,
  }
}

/** An adapter's settings its reader takes as arguments. */
function readerArgs(adapter: Record<string, unknown>): Record<string, string> {
  const { type, scoreColumn } = adapter
  return type === 'BigBedAdapter' &&
    typeof scoreColumn === 'string' &&
    scoreColumn
    ? { score_column: scoreColumn }
    : {}
}

function markExporter(
  accepted: readonly string[],
  specOf: (track: KeyedTrack) => DisplaySpec,
): RExporter {
  return (track, regions) => markPanels(track, regions, accepted, specOf(track))
}

/** A display as its config writes it, which leaves a mark's default type out. */
type WrittenDisplay = Omit<DisplaySpec, 'marks'> & {
  marks: (Omit<MarkConfig, 'mark'> & { mark?: MarkType })[]
}

function markPanels(
  track: KeyedTrack,
  regions: readonly Region[],
  accepted: readonly string[],
  written: WrittenDisplay,
): RExportPanels | RExportSkipped {
  const display: DisplaySpec = {
    ...written,
    marks: written.marks.map(m => ({
      ...m,
      mark: m.mark ?? DEFAULT_MARK_TYPE,
    })),
  }
  const located = locate(track, accepted)
  if ('skipped' in located) {
    return located
  }
  const { type, uri, index } = located
  const { key } = track
  const base = frameFor({
    type,
    uri,
    index,
    args: readerArgs(track.adapter),
    name: `df_${key}`,
    aliases: track.refNames,
    fields: fieldsRead(display),
  })
  const { plot, notes } = markPlot({
    display,
    frame: base,
    regions,
    viewBpPerPx: track.viewBpPerPx,
  })
  return {
    panels: [{ variable: `p_${key}`, plot }],
    notes: [...sourceNotes(uri), ...notes],
  }
}

/** Settings the engine has no table for yet, which the figure draws without. */
function featureNotes(display: Record<string, unknown>) {
  const color = display.color as { scale?: string; field?: string } | undefined
  return [
    ...(display.facet ? ['facet: drawn as one section'] : []),
    ...(color?.field && color.scale === 'linear'
      ? [`color: a linear ramp over ${color.field} keys no legend`]
      : []),
  ]
}

const featureExporter: RExporter = (track, regions) => {
  const source = engineSource('features', track.adapter)
  if ('skipped' in source) {
    return source
  }
  const written = engineDisplay(track.writtenDisplay ?? track.display)
  const result = engineResult({
    name: `genes_${track.key}`,
    regions,
    aliases: track.refNames,
    bpPerPx: zoomOf(regions, track.viewBpPerPx),
    call: span =>
      readerCall('features', [
        source.file,
        span.chrom,
        span.start,
        span.end,
        ...(source.index ? [`index = ${rStr(source.index)}`] : []),
        ...displayArg(written),
        `width = ${span.width}`,
      ]),
  })
  return {
    panels: [featurePanel({ result, regions })],
    notes: [...source.uris.flatMap(sourceNotes), ...featureNotes(written)],
  }
}

const wiggleExporter: RExporter = (track, regions) => {
  const source = engineSource('wiggle', track.adapter)
  if ('skipped' in source) {
    return source
  }
  const result = engineResult({
    name: `wig_${track.key}`,
    regions,
    aliases: track.refNames,
    bpPerPx: zoomOf(regions, track.viewBpPerPx),
    call: span =>
      readerCall('wiggle', [
        source.file,
        span.chrom,
        span.start,
        span.end,
        ...displayArg(engineDisplay(track.writtenDisplay ?? track.display)),
        `width = ${span.width}`,
      ]),
  })
  return {
    panels: [wigglePanel({ result, regions, display: track.display })],
    notes: source.uris.flatMap(sourceNotes),
  }
}

const alignmentsExporter: RExporter = (track, regions) => {
  const source = engineSource('alignments', track.adapter)
  if ('skipped' in source) {
    return source
  }
  const { panels, notes } = alignmentsPanels({
    display: track.display,
    written: track.writtenDisplay ?? track.display,
    source,
    regions,
    reference: track.reference,
    aliases: track.refNames,
    key: track.key,
    bpPerPx: zoomOf(regions, track.viewBpPerPx),
  })
  return { panels, notes: [...source.uris.flatMap(sourceNotes), ...notes] }
}

export const BUILTIN_EXPORTERS: Record<string, RExporter> = {
  LinearMarkDisplay: markExporter(
    Object.keys(READERS),
    track => track.display as unknown as DisplaySpec,
  ),
  LinearWiggleDisplay: wiggleExporter,
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
  notes: viewNotes = [],
}: {
  tracks: readonly RExportTrack[]
  regions: readonly Region[]
  exporters?: Record<string, RExporter>
  out?: string
  /** What the caller knows of the view that the figure does not show. */
  notes?: readonly string[]
}) {
  const panels: Panel[] = []
  const notes: string[] = [...viewNotes]
  for (const track of keyed(tracks)) {
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
