import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface MultiPairAdapter {
  getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken },
  ): Promise<{
    genomeNames: string[]
    genomeRows: Map<string, MultiPairFeature[]>
  }>
  getChromSizes?(): Promise<Map<string, { refName: string; length: number }[]>>
}

export interface MultiPairGetFeaturesArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  sessionId: string
  stopToken?: StopToken
  fetchChromSizes?: boolean
}

export interface MultiPairGetFeaturesResult {
  genomeNames: string[]
  genomeRows: [string, MultiPairFeature[]][]
  chromSizes?: [string, { refName: string; length: number }[]][]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiPairGetFeatures: {
      args: MultiPairGetFeaturesArgs
      return: MultiPairGetFeaturesResult
    }
  }
}

export class MultiPairGetFeatures extends RpcMethodType {
  name = 'MultiPairGetFeatures'

  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

  async execute(args: MultiPairGetFeaturesArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      adapterConfig,
      regions,
      bpPerPx,
      sessionId,
      stopToken,
      fetchChromSizes,
    } = deserializedArgs as MultiPairGetFeaturesArgs

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const adapter = dataAdapter as unknown as MultiPairAdapter

    let chromSizes:
      | [string, { refName: string; length: number }[]][]
      | undefined
    if (fetchChromSizes && adapter.getChromSizes) {
      const sizesMap = await adapter.getChromSizes()
      chromSizes = [...sizesMap.entries()]
    }

    const allGenomeRows = new Map<string, MultiPairFeature[]>()
    let allGenomeNames: string[] = []

    for (const region of regions) {
      const { genomeNames, genomeRows } = await adapter.getMultiPairFeatures(
        region,
        { bpPerPx, stopToken },
      )

      if (allGenomeNames.length === 0) {
        allGenomeNames = genomeNames
      }

      for (const [genome, features] of genomeRows) {
        const existing = allGenomeRows.get(genome)
        if (existing) {
          for (const f of features) {
            existing.push(f)
          }
        } else {
          allGenomeRows.set(genome, [...features])
        }
      }
    }

    return {
      genomeNames: allGenomeNames,
      genomeRows: [...allGenomeRows.entries()],
      chromSizes,
    }
  }
}
