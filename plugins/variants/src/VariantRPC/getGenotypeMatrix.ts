import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { GetGenotypeMatrixArgs } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export async function getGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: GetGenotypeMatrixArgs
}) {
  const {
    sources,
    minorAlleleFrequencyFilter,
    regions,
    adapterConfig,
    sessionId,
    lengthCutoffFilter,
    stopToken,
  } = args
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  const genotypeFactor = new Set<string>()
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    stopToken,
    features: await firstValueFrom(
      dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
    ),
  })

  for (const { alleleCounts } of mafs) {
    for (const alt of Object.keys(alleleCounts)) {
      genotypeFactor.add(alt)
    }
  }

  const rows = {} as Record<string, number[]>
  const cacheSplit = {} as Record<string, string[]>
  forEachWithStopTokenCheck(mafs, stopToken, ({ feature }) => {
    const genotypes = feature.get('genotypes') as Record<string, string>
    for (const { name } of sources) {
      if (!rows[name]) {
        rows[name] = []
      }
      const val = genotypes[name]!

      let alleles: string[]
      if (cacheSplit[val]) {
        alleles = cacheSplit[val]
      } else {
        alleles = val.split(/[/|]/)
        cacheSplit[val] = alleles
      }

      // Calculate '012' status of the allele for a VCF genotype matrix
      // Similar to vcftools --012 https://vcftools.github.io/man_latest.html
      // Note: could also consider https://www.rdocumentation.org/packages/fastcluster/versions/1.2.6/topics/hclust.vector for clustering true multi-dimensional allele count vectors
      let genotypeStatus = 0
      let nonRefCount = 0
      let uncalledCount = 0
      for (const l of alleles) {
        if (l === '.') {
          uncalledCount++
        } else if (l !== '0') {
          nonRefCount++
        }
      }

      if (uncalledCount === alleles.length) {
        genotypeStatus = -1 // All no-call
      } else if (nonRefCount === 0) {
        genotypeStatus = 0 // Homozygous reference
      } else if (nonRefCount === alleles.length) {
        genotypeStatus = 2 // Homozygous alternate
      } else {
        genotypeStatus = 1 // Heterozygous
      }

      rows[name].push(genotypeStatus)
    }
  })
  return rows
}
