import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { isAbortException } from '@jbrowse/core/util/aborting'

import { peptideTargets } from './glyphs/findGlyph.ts'

import type { DomainData, ProteinFeatures } from './collect/renderContext.ts'
import type { DisplayConfig } from './renderConfig.ts'
import type { RenderFeatureDataArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'

type ProteinFeaturesArg = NonNullable<RenderFeatureDataArgs['proteinFeatures']>

/** The notice for a `proteinFeatures` track that failed, rethrowing an abort. */
export function failureNotice(error: unknown) {
  if (isAbortException(error)) {
    throw error
  }
  return `proteinFeatures: ${error instanceof Error ? error.message : String(error)}`
}

export function joinKey(value: unknown) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined
}

function groupByTranscript(rows: Feature[], field: string) {
  const byTranscript = new Map<string, DomainData[]>()
  for (const row of rows) {
    const key = joinKey(row.get(field))
    const blocks = (row.get('subfeatures') ?? [row])
      .map(b => ({ start: b.get('start'), end: b.get('end') }))
      .filter(b => b.end > b.start)
    if (key !== undefined && blocks.length > 0) {
      const list = byTranscript.get(key) ?? []
      list.push({ feature: row, blocks })
      byTranscript.set(key, list)
    }
  }
  return byTranscript
}

async function fetchProteinFeatures({
  pluginManager,
  sessionId,
  arg,
  region,
  transcripts,
  byteLimit,
  signal,
}: ProteinFeaturesFetch) {
  const adapter = await getFeatureAdapterOrThrow({
    adapterConfig: arg.adapter,
    sessionId,
    pluginManager,
  })
  const span = {
    assemblyName: region.assemblyName,
    refName: arg.refName,
    start: Math.min(...transcripts.map(t => t.get('start'))),
    end: Math.max(...transcripts.map(t => t.get('end'))),
  }
  const { tooLarge } = await measureRegionBytes({
    dataAdapter: adapter,
    regions: [span],
    byteLimit,
    signal,
  })
  if (tooLarge) {
    return {
      notice: `proteinFeatures: ${tooLarge.bytes} bytes of domains here, over the ${byteLimit}-byte limit`,
    }
  }
  const rows = await adapter.getFeaturesArray(span, { signal })
  return {
    proteinFeatures: {
      byTranscript: groupByTranscript(rows, arg.join.domain),
      color: arg.color,
      transcriptKey: arg.join.gene,
    } satisfies ProteinFeatures,
  }
}

interface ProteinFeaturesResult {
  proteinFeatures?: ProteinFeatures
  notice?: string
}

interface ProteinFeaturesFetch {
  pluginManager: PluginManager
  sessionId: string
  arg: ProteinFeaturesArg
  region: Region
  transcripts: Feature[]
  byteLimit?: number
  signal?: AbortSignal
}

/**
 * The domains of `features`' transcripts, keyed for the join, fetched once
 * over the transcripts' combined span under the region's byte budget, so a
 * domain whose blocks reach past the region still draws whole; or a notice
 * where the track failed. An abort still rejects.
 */
export async function fetchProteinFeaturesOrNotice({
  features,
  config,
  ...args
}: Omit<ProteinFeaturesFetch, 'transcripts'> & {
  features: Map<string, Feature>
  config: DisplayConfig
}): Promise<ProteinFeaturesResult> {
  const transcripts = [...features.values()].flatMap(f =>
    peptideTargets(f, config),
  )
  if (transcripts.length === 0) {
    return {}
  }
  try {
    return await fetchProteinFeatures({ ...args, transcripts })
  } catch (error) {
    return { notice: failureNotice(error) }
  }
}
