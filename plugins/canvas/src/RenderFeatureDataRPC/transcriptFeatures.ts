import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { isAbortException } from '@jbrowse/core/util/aborting'

import { mergeSpans } from '../shared/mergeSpans.ts'
import { getSubfeatures, isCDS, isExon, isUTR } from './util.ts'

import type { Span } from '../shared/mergeSpans.ts'
import type {
  AttachableRow,
  TranscriptFeatures,
} from './collect/renderContext.ts'
import type {
  TranscriptFeatureTrackArg,
  TranscriptFeaturesArg,
} from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * How far past its exon a row's block may reach and still fit: domain
 * mappers overshoot an exon end by up to a codon. The overshoot is clipped
 * off what draws.
 */
export const EDGE_SLOP_BP = 3

/** The notice for a `transcriptFeatures` track that failed, rethrowing an abort. */
export function failureNotice(error: unknown) {
  if (isAbortException(error)) {
    throw error
  }
  return `transcriptFeatures: ${error instanceof Error ? error.message : String(error)}`
}

export function joinKey(value: unknown) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined
}

function rowOf(feature: Feature, field: string): AttachableRow | undefined {
  const subs = feature.get('subfeatures')
  const blocks = mergeSpans(
    (subs?.length ? subs : [feature]).map(
      b => [b.get('start'), b.get('end')] as const,
    ),
  ).filter(([start, end]) => end > start)
  return blocks.length > 0
    ? {
        feature,
        blocks,
        key: field ? joinKey(feature.get(field)) : undefined,
      }
    : undefined
}

/**
 * The spans a row must lie in to fit `transcript`: its coding pieces for
 * `on: 'cds'`, none on a non-coding transcript; its exons for `on: 'exon'`,
 * from exon, CDS and UTR children alike, so a GFF3 mRNA and a BED12 split at
 * its thick ends give the same spans.
 */
export function transcriptParts(transcript: Feature, on: 'cds' | 'exon') {
  const subs = getSubfeatures(transcript)
  const parts = subs.filter(
    on === 'cds' ? isCDS : s => isExon(s) || isCDS(s) || isUTR(s),
  )
  return mergeSpans(
    (parts.length > 0 || on === 'cds' ? parts : [transcript]).map(
      p => [p.get('start'), p.get('end')] as const,
    ),
  )
}

/**
 * `blocks` clipped to `parts`, where each block lies in one part (within
 * `EDGE_SLOP_BP`) and no part between the first block's and the last's goes
 * without a block — Bioconductor's compatible overlap, loosened so a block may
 * end inside its exon, as an alignment gap does. Undefined where the row skips
 * an exon, falls in an intron, or reaches past the transcript.
 */
export function fitToParts(blocks: readonly Span[], parts: readonly Span[]) {
  const drawn: Span[] = []
  let part = 0
  let previous = -1
  for (const [start, end] of blocks) {
    while (part < parts.length && parts[part]![1] + EDGE_SLOP_BP < end) {
      part++
    }
    const host = parts[part]
    if (
      !host ||
      start < host[0] - EDGE_SLOP_BP ||
      (previous !== -1 && part > previous + 1)
    ) {
      return undefined
    }
    previous = part
    const clipped: Span = [Math.max(start, host[0]), Math.min(end, host[1])]
    if (clipped[1] > clipped[0]) {
      drawn.push(clipped)
    }
  }
  return drawn.length > 0 ? drawn : undefined
}

function firstAtOrAfter(rows: readonly AttachableRow[], bp: number) {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (rows[mid]!.blocks[0]![0] < bp) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

export interface Attached {
  feature: Feature
  blocks: Span[]
  track: number
  trackId: string
}

/**
 * Every row of every `transcriptFeatures` track that fits `transcript`, and
 * whose join field, where the track names one, equals the transcript's.
 * A row repeating another's name and drawn blocks is dropped, so a file with
 * one row per transcript draws each domain once on an isoform that shares it.
 */
export function attachToTranscript(
  transcript: Feature,
  features: TranscriptFeatures,
) {
  const start = transcript.get('start')
  const end = transcript.get('end')
  const attached: Attached[] = []
  const seen = new Set<string>()
  for (const [track, layer] of features.tracks.entries()) {
    const parts = transcriptParts(transcript, layer.on)
    if (parts.length === 0) {
      continue
    }
    const key = layer.join.field
      ? joinKey(transcript.get(layer.join.transcriptField))
      : undefined
    const rows = layer.rows
    for (
      let i = firstAtOrAfter(rows, start - EDGE_SLOP_BP);
      i < rows.length && rows[i]!.blocks[0]![0] < end;
      i++
    ) {
      const row = rows[i]!
      layer.candidates++
      if (layer.join.field && (key === undefined || row.key !== key)) {
        continue
      }
      const blocks = fitToParts(row.blocks, parts)
      const id =
        blocks && `${track}:${row.feature.get('name')}:${blocks.join(',')}`
      if (blocks && !seen.has(id!)) {
        seen.add(id!)
        layer.attached++
        attached.push({
          feature: row.feature,
          blocks,
          track,
          trackId: layer.trackId,
        })
      }
    }
  }
  return attached
}

/**
 * The notice for a track whose rows met transcripts here and fit none, which
 * a join on the wrong field or rows built against other gene models causes.
 */
export function unfitNotices(features: TranscriptFeatures | undefined) {
  return (features?.tracks ?? []).flatMap(layer =>
    layer.candidates > 0 && layer.attached === 0
      ? [
          `transcriptFeatures: no row of "${layer.trackId}" here fits a transcript's ${layer.on === 'cds' ? 'coding exons' : 'exons'}${
            layer.join.field
              ? ` with its ${layer.join.transcriptField} equal to the row's ${layer.join.field}`
              : ''
          }`,
        ]
      : [],
  )
}

async function fetchTrack({
  pluginManager,
  sessionId,
  arg,
  span,
  jexl,
  byteLimit,
  signal,
}: {
  pluginManager: PluginManager
  sessionId: string
  arg: TranscriptFeatureTrackArg
  span: Region
  jexl: JexlInstance
  byteLimit?: number
  signal?: AbortSignal
}) {
  const adapter = await getFeatureAdapterOrThrow({
    adapterConfig: arg.adapter,
    sessionId,
    pluginManager,
  })
  const region = { ...span, refName: arg.refName }
  const { tooLarge } = await measureRegionBytes({
    dataAdapter: adapter,
    regions: [region],
    byteLimit,
    signal,
  })
  if (tooLarge) {
    throw new Error(
      `${tooLarge.bytes} bytes of "${arg.trackId}" here, over the ${byteLimit}-byte limit`,
    )
  }
  const filter = new SerializableFilterChain({ filters: arg.filter, jexl })
  return (await adapter.getFeaturesArray(region, { signal }))
    .filter(row => filter.passes(row))
    .flatMap(row => rowOf(row, arg.join.field) ?? [])
    .sort((a, b) => a.blocks[0]![0] - b.blocks[0]![0])
}

/**
 * The rows of each `transcriptFeatures` track over the features' combined
 * span, so a row reaching past the region still fits whole, with a notice for
 * each track that failed or ran over the byte budget while the rest still
 * draw. An abort still rejects.
 */
export async function fetchTranscriptFeatures({
  features,
  arg: { tracks, color },
  region,
  ...args
}: {
  pluginManager: PluginManager
  sessionId: string
  arg: TranscriptFeaturesArg
  region: Region
  features: Map<string, Feature>
  jexl: JexlInstance
  byteLimit?: number
  signal?: AbortSignal
}): Promise<{ transcriptFeatures?: TranscriptFeatures; notices: string[] }> {
  const all = [...features.values()]
  if (all.length === 0 || tracks.length === 0) {
    return { notices: [] }
  }
  const span = {
    ...region,
    start: Math.min(...all.map(f => f.get('start'))),
    end: Math.max(...all.map(f => f.get('end'))),
  }
  const notices: string[] = []
  const fetched = await Promise.all(
    tracks.map(async arg => {
      try {
        return await fetchTrack({ ...args, arg, span })
      } catch (error) {
        notices.push(failureNotice(error))
        return []
      }
    }),
  )
  return {
    transcriptFeatures: {
      tracks: fetched.map((rows, i) => ({
        trackId: tracks[i]!.trackId,
        rows,
        on: tracks[i]!.on,
        join: tracks[i]!.join,
        candidates: 0,
        attached: 0,
      })),
      color,
    },
    notices,
  }
}
