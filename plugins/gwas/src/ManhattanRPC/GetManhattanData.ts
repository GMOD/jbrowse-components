import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { GetManhattanDataArgs, ManhattanRpcResult } from './rpcTypes.ts'
import type { Region } from '@jbrowse/core/util'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetManhattanData: {
      args: GetManhattanDataArgs
      return: ManhattanRpcResult
    }
  }
}

// A `chr:bp` index SNP carries the *assembly* reference name, but the LD adapter
// (and the renamed query region) use the data adapter's reference-name alias —
// so position matching in the worker silently fails across aliases (e.g.
// `chr2:..` vs `2:..`). Express the index as a 1-bp region so it rides through
// the same `renameRegionsIfNeeded` pass as the query and lands in the same alias
// space. Returns undefined for a bare SNP-id index (no parseable position) —
// that matches by name and needs no renaming.
function indexSnpAsRegion(args: GetManhattanDataArgs): Region | undefined {
  const { indexSnp, region } = args
  let out: Region | undefined
  if (indexSnp) {
    const colon = indexSnp.lastIndexOf(':')
    const bp = colon > 0 ? Number(indexSnp.slice(colon + 1)) : Number.NaN
    if (Number.isFinite(bp)) {
      out = {
        refName: indexSnp.slice(0, colon),
        start: bp - 1,
        end: bp,
        assemblyName: region.assemblyName,
      }
    }
  }
  return out
}

export default class GetManhattanData extends RpcMethodType {
  name = 'GetManhattanData'

  async serializeArguments(args: GetManhattanDataArgs, rpcDriver: string) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (assemblyManager) {
      const indexRegion = indexSnpAsRegion(args)
      const { regions } = await renameRegionsIfNeeded(assemblyManager, {
        sessionId: args.sessionId,
        adapterConfig: args.adapterConfig,
        regions: indexRegion ? [args.region, indexRegion] : [args.region],
      })
      const renamedRegion = regions[0] ?? args.region
      const renamedIndex = indexRegion && regions[1]
      const indexSnp = renamedIndex
        ? `${regions[1]!.refName}:${regions[1]!.end}`
        : args.indexSnp
      return super.serializeArguments(
        { ...args, region: renamedRegion, indexSnp },
        rpcDriver,
      )
    }
    return super.serializeArguments(args, rpcDriver)
  }

  async execute(args: GetManhattanDataArgs, _rpcDriver: string) {
    const { executeGetManhattanData } =
      await import('./executeGetManhattanData.ts')
    return executeGetManhattanData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
