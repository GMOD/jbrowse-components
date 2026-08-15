import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { parseChrBp } from './parseChrBp.ts'
import { ldColoringRequested } from './rpcTypes.ts'

import type { GetManhattanDataArgs, ManhattanRpcResult } from './rpcTypes.ts'
import type {
  RpcCallContext,
  RpcExecuteArgs,
} from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { RpcResult } from '@jbrowse/core/util/librpc'

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

export default class GetManhattanData extends RpcMethodType<
  'GetManhattanData',
  RpcResult<ManhattanRpcResult>
> {
  name = 'GetManhattanData' as const

  async serializeArguments(
    args: GetManhattanDataArgs & RpcCallContext,
    rpcDriver: string,
  ) {
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
      {
        ...args,
        region: regions[0]!,
        indexSnp,
        ldRefName: await this.ldRefName(args),
      },
      rpcDriver,
    )
  }

  // The LD sub-adapter's name for the query contig.
  //
  // `renameRegions` maps against `args.adapterConfig` — the GWAS file — and the
  // PLINK `.ld` named in `ldAdapterConfig` is a separate file that may spell the
  // same contig differently, so the region renamed above is not a valid query
  // for it. A second pass, against that config, is what makes it one.
  //
  // Gated on `ldColoringRequested`, the same predicate the worker gates the LD
  // read on, and deliberately so: resolving a refName map calls the adapter's
  // `getRefNames`, which for the in-memory PLINK adapter parses the whole `.ld`
  // file. Doing that for a track drawn in normal coloring mode would be a
  // download nobody asked for.
  private async ldRefName(args: GetManhattanDataArgs & RpcCallContext) {
    if (!ldColoringRequested(args)) {
      return undefined
    }
    const { regions } = await this.renameRegions({
      ...args,
      adapterConfig: args.ldAdapterConfig,
      // `args.region`, NOT the renamed `regions[0]` above. A refName map is
      // keyed by the assembly's *canonical* names (`loadRefNameMap` builds it
      // as `result[getCanonicalRefName(name)] = name`), so a second pass has to
      // start from the canonical name too. Feeding it the GWAS-renamed region
      // finds no entry and falls through unchanged — reintroducing this very
      // bug, silently, in exactly the case it is meant to fix (the two files
      // disagreeing). The two regions are the same type and both in scope, so
      // this is one substitution away at all times.
      regions: [args.region],
    })
    return regions[0]!.refName
  }

  async execute(args: RpcExecuteArgs<'GetManhattanData'>) {
    const { executeGetManhattanData } =
      await import('./executeGetManhattanData.ts')
    return executeGetManhattanData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
