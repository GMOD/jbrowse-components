import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter } from '@jbrowse/core/util'
import { createAbortBreakpoint } from '@jbrowse/core/util/aborting'

import { buildSampleIndex } from '../shared/genotypeCodec.ts'
import { filterVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import { collectSampleNames, makeHeaderRemapper } from './analyzeVariants.ts'
import { fetchVariantFeatures } from './fetchVariantFeatures.ts'

import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import type { GetGenotypeMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { StatusCallback } from '@jbrowse/core/util'

export interface MatrixWalkArgs extends GetGenotypeMatrixArgs {
  signal?: AbortSignal
  sessionId: string
  statusCallback?: StatusCallback
}

/**
 * What both genotype matrices start from: the fetch's features through the
 * filters, and the canonical sample columns their genotypes are read into.
 *
 * `sampleIdxByKey` is the union of every header in the fetch, not feature 0's
 * list: a SplitVcfTabixAdapter opens one header per refName, and `headerRemapOf`
 * lines each feature's own header up against the union.
 */
export async function prepareMatrixWalk({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MatrixWalkArgs
}) {
  const { regions, signal, statusCallback, filters } = args
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })
  const rawFeatures = await fetchVariantFeatures(dataAdapter, regions, args)

  const breakpoint = createAbortBreakpoint(signal)
  const reportFiltered = createProgressReporter({
    label: 'Filtering variants',
    total: rawFeatures.length,
    statusCallback,
    signal,
  })
  const filteredVariants: FilteredVariant[] = []
  for (const feature of rawFeatures) {
    const kept = filterVariant(feature, args, filters)
    if (kept) {
      filteredVariants.push(kept)
    }
    reportFiltered()
    if (breakpoint.due()) {
      await breakpoint.yield()
    }
  }

  const sampleIdxByKey = buildSampleIndex(
    collectSampleNames(filteredVariants.map(v => v.feature)),
  )
  return {
    filteredVariants,
    sampleIdxByKey,
    samplesLen: sampleIdxByKey.size,
    headerRemapOf: makeHeaderRemapper(sampleIdxByKey),
    breakpoint,
    report: createProgressReporter({
      label: 'Building genotype matrix',
      total: filteredVariants.length,
      statusCallback,
      signal,
    }),
  }
}
