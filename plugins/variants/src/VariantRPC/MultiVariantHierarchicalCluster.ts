import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import type { Feature, Region } from '@jbrowse/core/util'
import { clusterData } from '@greenelab/hclust'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { firstValueFrom, toArray } from 'rxjs'

export class MultiVariantHierarchicalCluster extends RpcMethodType {
  name = 'MultiVariantHierarchicalCluster'

  async deserializeArguments(args: any, rpcDriverClassName: string) {
    const l = await super.deserializeArguments(args, rpcDriverClassName)
    return {
      ...l,
      filters: args.filters
        ? new SerializableFilterChain({
            filters: args.filters,
          })
        : undefined,
    }
  }

  async serializeArguments(
    args: RenderArgs & {
      stopToken?: string
      statusCallback?: (arg: string) => void
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, {
      ...args,
      filters: args.filters?.toJSON().filters,
    })

    return super.serializeArguments(renamedArgs, rpcDriverClassName)
  }

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
      statusCallback,
      sources,
      mafFilter,
      regions,
      adapterConfig,
      sessionId,
    } = deserializedArgs
    const adapter = await getAdapter(pm, sessionId, adapterConfig)
    const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter
    const region = regions[0]

    const feats = await firstValueFrom(
      dataAdapter.getFeatures(region, deserializedArgs).pipe(toArray()),
    )

    // a 'factor' in the R sense of the term (ordinal)
    const genotypeFactor = new Set<string>()
    const mafs = [] as Feature[]
    for (const feat of feats) {
      let c = 0
      let c2 = 0
      const samp = feat.get('genotypes')

      // only draw smallish indels
      if (feat.get('end') - feat.get('start') <= 10) {
        for (const { name } of sources) {
          const s = samp[name]!
          genotypeFactor.add(s)
          if (s === '0|0' || s === './.') {
            c2++
          } else if (s === '1|0' || s === '0|1') {
            c++
          } else if (s === '1|1') {
            c++
            c2++
          } else {
            c++
          }
        }
        if (
          c / sources.length > mafFilter &&
          c2 / sources.length < 1 - mafFilter
        ) {
          mafs.push(feat)
        }
      }
    }

    const genotypeFactorMap = Object.fromEntries(
      [...genotypeFactor].map((type, idx) => [type, idx]),
    )
    const rows = {} as Record<string, { name: string; genotypes: number[] }>
    for (const feat of mafs) {
      const samp = feat.get('genotypes') as Record<string, string>
      for (const { name } of sources) {
        if (!rows[name]) {
          rows[name] = { name, genotypes: [] }
        }
        rows[name].genotypes.push(genotypeFactorMap[samp[name]!]!)
      }
    }

    return clusterData({
      data: Object.values(rows),
      key: 'genotypes',
      onProgress: arg => {
        statusCallback(arg)
      },
    })
  }
}
