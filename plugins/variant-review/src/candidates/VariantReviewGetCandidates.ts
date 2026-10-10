import { isFeatureAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { checkAbortSignal } from '@jbrowse/core/util'

import { candidateId, dedupeCandidateIds } from './candidateId.ts'
import { classifyRecord } from './sortCoordinate.ts'

import type { CandidateVariant } from './types.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region } from '@jbrowse/core/util'

export interface VariantReviewGetCandidatesArgs {
  adapterConfig: Record<string, unknown>
  // every region of the assembly, resolved on the main thread: a worker has no
  // assembly manager
  regions: Region[]
  // `regions[i]`'s canonical refName, index-aligned. The base class renames
  // `regions` into the adapter's namespace before they get here, so the name a
  // candidate is filed under has to travel separately.
  canonicalRefNames: string[]
  // canonical, for the candidate ids
  assemblyName: string
  infoFields: string[]
  maxCandidates: number
  filters?: SerializableFilterChain
}

export interface VariantReviewGetCandidatesResult {
  candidates: CandidateVariant[]
  truncated: boolean
  // true duplicate records, suffixed `#2`, `#3`, …
  duplicates: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    VariantReviewGetCandidates: {
      args: VariantReviewGetCandidatesArgs
      return: VariantReviewGetCandidatesResult
    }
  }
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
      ? [value]
      : []
}

/**
 * One record as a plain object. Reads only the named fields: `toJSON()` and
 * `get('samples')`/`get('genotypes')` carry every sample's genotype, which on a
 * cohort VCF is the whole matrix cloned to the main thread.
 */
export function candidateFromFeature(
  feature: Feature,
  refName: string,
  assemblyName: string,
  infoFields: readonly string[],
): CandidateVariant {
  const start = feature.get('start')
  const end = feature.get('end')
  const ref = String(feature.get('REF') ?? '')
  const alt = asStringArray(feature.get('ALT'))
  const filter = asStringArray(feature.get('FILTER'))
  const qual = feature.get('QUAL')
  const vcfId = feature.get('name')
  const fullInfo = (feature.get('INFO') ?? {}) as Record<string, unknown>
  const info: Record<string, unknown> = {}
  for (const key of infoFields) {
    if (fullInfo[key] !== undefined) {
      info[key] = fullInfo[key]
    }
  }
  const { kind, sort } = classifyRecord(start, ref, alt)
  return {
    id: candidateId({
      assemblyName,
      refName,
      pos1: start + 1,
      ref,
      alts: alt,
      end0: end,
    }),
    assemblyName,
    refName,
    start,
    end,
    pos1: start + 1,
    ref,
    alt,
    vcfId: typeof vcfId === 'string' && vcfId !== '.' ? vcfId : undefined,
    filter: filter.length > 0 ? filter : undefined,
    qual: typeof qual === 'number' ? qual : undefined,
    info,
    kind,
    sort,
    sourceFeatureId: feature.id(),
  }
}

export class VariantReviewGetCandidates extends RpcMethodTypeWithFiltersAndRenameRegions<'VariantReviewGetCandidates'> {
  name = 'VariantReviewGetCandidates' as const

  async execute(args: RpcExecuteArgs<'VariantReviewGetCandidates'>) {
    const {
      regions,
      canonicalRefNames,
      assemblyName,
      infoFields,
      maxCandidates,
      filters,
      adapterConfig,
      sessionId,
      signal,
      statusCallback,
    } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Expected a feature data adapter')
    }
    const candidates: CandidateVariant[] = []
    let truncated = false
    // One region at a time, in assembly order: whole-contig regions share no
    // record, so there is nothing to dedupe across them, and the cap stops the
    // scan rather than trimming a finished one.
    for (const [i, region] of regions.entries()) {
      checkAbortSignal(signal)
      statusCallback?.(
        `Reading candidates (${i + 1}/${regions.length} sequences)`,
      )
      const features = await dataAdapter.getFeaturesArray(region, {
        signal,
        statusCallback,
      })
      const refName = canonicalRefNames[i] ?? region.refName
      for (const feature of features) {
        if (filters && !filters.passes(feature)) {
          continue
        }
        if (candidates.length >= maxCandidates) {
          truncated = true
          break
        }
        candidates.push(
          candidateFromFeature(feature, refName, assemblyName, infoFields),
        )
      }
      if (truncated) {
        break
      }
    }
    statusCallback?.('')
    const duplicates = dedupeCandidateIds(candidates)
    return { candidates, truncated, duplicates }
  }
}
