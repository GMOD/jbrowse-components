import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { buildSyntenyRegionData } from './buildSyntenyRegionData.ts'

import type {
  MultiPairGetFeaturesArgs,
  MultiPairGetFeaturesResult,
  SyntenyRegionData,
} from './syntenyRegionTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

interface MultiPairAdapter {
  getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken },
  ): Promise<{
    genomeRows: Map<string, MultiPairFeature[]>
  }>
  getSources(): Promise<{ name: string }[]>
  getChromSizes?(): Promise<Map<string, { refName: string; length: number }[]>>
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
    } = deserializedArgs

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

    const regionData: [number, SyntenyRegionData][] = []

    for (const { region, displayedRegionIndex } of regions) {
      const { genomeRows } = await adapter.getMultiPairFeatures(region, {
        bpPerPx,
        stopToken,
      })
      regionData.push([
        displayedRegionIndex,
        buildSyntenyRegionData(region, [...genomeRows]),
      ])
    }

    return {
      regionData,
      sources,
      chromSizes,
    }
  }
}
