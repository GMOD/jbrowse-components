import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

export class MultiVariantGetGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetGenotypeMatrix'

  async execute(
    args: {
      adapterConfig: AnyConfigurationModel
      stopToken?: string
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      sources,
      minorAlleleFrequencyFilter,
      regions,
      adapterConfig,
      sessionId,
    } = deserializedArgs
    const adapter = await getAdapter(pm, sessionId, adapterConfig)
    const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

    const feats = await firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(regions, deserializedArgs)
        .pipe(toArray()),
    )

    const genotypeFactor = new Set<string>()
    const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
      feats,
      minorAlleleFrequencyFilter,
    )

    for (const { alleleCounts } of mafs) {
      for (const alt of alleleCounts.keys()) {
        genotypeFactor.add(alt)
      }
    }

    const rows = {} as Record<string, { name: string; genotypes: string[] }>
    for (const { feature } of mafs) {
      const genotypes = feature.get('genotypes') as Record<string, string>
      for (const { name } of sources) {
        if (!rows[name]) {
          rows[name] = {
            name,
            genotypes: [],
          }
        }
        const val = genotypes[name]!
        const alleles = val.split(/[/|]/)

        // Calculate '012' status of the allele for a VCF genotype matrix
        // Similar to vcftools --012 https://vcftools.github.io/man_latest.html
        // Note: could also consider https://www.rdocumentation.org/packages/fastcluster/versions/1.2.6/topics/hclust.vector for clustering true multi-dimensional allele count vectors
        let genotypeStatus = '0'
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
          genotypeStatus = '-1' // All no-call
        } else if (nonRefCount === 0) {
          genotypeStatus = '0' // Homozygous reference
        } else if (nonRefCount === alleles.length) {
          genotypeStatus = '2' // Homozygous alternate
        } else {
          genotypeStatus = '1' // Heterozygous
        }

        rows[name].genotypes.push(genotypeStatus)
      }
    }

    return rows
  }
}
