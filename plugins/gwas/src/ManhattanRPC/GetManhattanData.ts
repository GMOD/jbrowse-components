import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { parseChrBp } from './parseChrBp.ts'

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
  // bp >= 1 guards against a bogus {start:-1} region; a bare rsID (parseChrBp
  // returns undefined) matches by name and needs no renaming
  const parsed = indexSnp ? parseChrBp(indexSnp) : undefined
  return parsed && parsed.bp >= 1
    ? {
        refName: parsed.refName,
        start: parsed.bp - 1,
        end: parsed.bp,
        assemblyName: region.assemblyName,
      }
    : undefined
}

export default class GetManhattanData extends RpcMethodType {
  name = 'GetManhattanData'

  async serializeArguments(args: GetManhattanDataArgs, rpcDriver: string) {
    // bundle the query region and (when parseable) the index-SNP position into
    // one regions array so both ride through the same renaming pass and land in
    // the data adapter's alias space
    const indexRegion = indexSnpAsRegion(args)
    const { regions } = await this.renameRegions({
      ...args,
      regions: indexRegion ? [args.region, indexRegion] : [args.region],
    })
    const indexSnp = indexRegion
      ? `${regions[1]!.refName}:${regions[1]!.end}`
      : args.indexSnp
    return super.serializeArguments(
      { ...args, region: regions[0]!, indexSnp },
      rpcDriver,
    )
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
