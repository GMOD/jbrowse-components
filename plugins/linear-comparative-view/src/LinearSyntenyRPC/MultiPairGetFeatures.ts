import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface MultiPairAdapter {
  getMultiPairFeatures(
    query: Region,
    opts: {
      bpPerPx?: number
      snpBpPerPxThreshold?: number
      stopToken?: StopToken
    },
  ): Promise<{
    genomeRows: Map<string, MultiPairFeature[]>
  }>
  getSources(): Promise<{ name: string }[]>
  getChromSizes?(): Promise<Map<string, { refName: string; length: number }[]>>
}

export interface MultiPairGetFeaturesArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  sessionId: string
  stopToken?: StopToken
  fetchMetadata?: boolean
  statusCallback?: (msg: string) => void
}

export interface MultiPairGetFeaturesResult {
  genomeRows: [string, MultiPairFeature[]][]
  sources?: { name: string }[]
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
      fetchMetadata,
    } = deserializedArgs as MultiPairGetFeaturesArgs

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const adapter = dataAdapter as unknown as MultiPairAdapter

    let sources: { name: string }[] | undefined
    let chromSizes:
      | [string, { refName: string; length: number }[]][]
      | undefined

    if (fetchMetadata) {
      sources = await adapter.getSources()
      if (adapter.getChromSizes) {
        chromSizes = [...(await adapter.getChromSizes()).entries()]
      }
    }

    const allGenomeRows = new Map<string, MultiPairFeature[]>()

    for (const region of regions) {
      const { genomeRows } = await adapter.getMultiPairFeatures(region, {
        bpPerPx,
        stopToken,
      })

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
      genomeRows: [...allGenomeRows.entries()],
      sources,
      chromSizes,
    }
  }
}
