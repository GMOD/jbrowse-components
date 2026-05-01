import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

interface MultiPairAdapter {
  getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken },
  ): Promise<{ genomeRows: Map<string, MultiPairFeature[]> }>
}

export interface SyntenyBlockEntry {
  refStart: number
  refEnd: number
  mateRefName: string
  mateStart: number
  mateEnd: number
  strand: number
  identity: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetSyntenyBlocks: {
      args: {
        adapterConfig: Record<string, unknown>
        region: Region
        sessionId: string
        bpPerPx?: number
      }
      return: [string, SyntenyBlockEntry[]][]
    }
  }
}

export class GetSyntenyBlocks extends RpcMethodType {
  name = 'GetSyntenyBlocks'

  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

  async execute(args: Record<string, unknown>, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { adapterConfig, region, sessionId, bpPerPx } = deserializedArgs as {
      adapterConfig: Record<string, unknown>
      region: Region
      sessionId: string
      bpPerPx?: number
    }

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const adapter = dataAdapter as unknown as Partial<MultiPairAdapter>
    if (typeof adapter.getMultiPairFeatures !== 'function') {
      return []
    }
    const { genomeRows } = await adapter.getMultiPairFeatures(region, {
      bpPerPx,
    })

    const result: [string, SyntenyBlockEntry[]][] = []
    for (const [genome, features] of genomeRows) {
      const entries: SyntenyBlockEntry[] = []
      for (const f of features) {
        entries.push({
          refStart: f.start,
          refEnd: f.end,
          mateRefName: f.mateRefName,
          mateStart: f.mateStart,
          mateEnd: f.mateEnd,
          strand: f.strand,
          identity: f.identity,
        })
      }
      result.push([genome, entries])
    }
    return result
  }
}
