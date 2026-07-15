import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { makeBlockFeatures } from '../mcscanUtil.ts'
import { parseBed, readFile } from '../util.ts'

import type { MCScanBlocksAdapterConfig } from './configSchema.ts'
import type { BareFeature, BlockRow } from '../mcscanUtil.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

// A .blocks file has one column per genome (column 0 is the reference). Because
// it describes N genomes at once, one track can back every band of a multi-way
// view: parse all columns + BEDs once, then resolve which pair to draw per query
// from the queried assembly and the band's target assembly. A given track draws
// the pair (query assembly, target assembly); with a legacy 2-entry
// assemblyNames config and no target, the sole other assembly is the mate.
export default class MCScanBlocksAdapter extends BaseFeatureDataAdapter<MCScanBlocksAdapterConfig> {
  private setupP?: Promise<{
    blockAssemblies: string[]
    bedMaps: Map<string, BareFeature>[]
    blockLines: string[][]
  }>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts: BaseOptions) {
    this.setupP ??= this.setupPre(opts).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  async setupPre(opts: BaseOptions) {
    const { statusCallback = () => {} } = opts
    const blockAssemblies = this.getConf('blockAssemblies') as string[]
    const bedLocations = this.getConf('bedLocations') as FileLocation[]
    const pm = this.pluginManager
    const blocks = openLocation(this.getConf('mcscanBlocksLocation'), pm)
    const [blockstext, ...bedtexts] = await updateStatus(
      'Downloading data',
      statusCallback,
      () =>
        Promise.all(
          [blocks, ...bedLocations.map(b => openLocation(b, pm))].map(r =>
            readFile(r, opts),
          ),
        ),
    )
    return {
      blockAssemblies,
      bedMaps: bedtexts.map(t => parseBed(t)),
      blockLines: blockstext!
        .split(/\n|\r\n|\r/)
        .filter(f => !!f)
        .map(l => l.split('\t')),
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseFeatureDataAdapter filters it out)
    return true
  }

  // Join the two columns of a pair into gene-link rows (both sides present).
  private buildPairRows(
    colA: number,
    colB: number,
    bedMaps: Map<string, BareFeature>[],
    blockLines: string[][],
  ) {
    return blockLines
      .map((cols, rowNum) => {
        const nameA = cols[colA]
        const nameB = cols[colB]
        const rA = nameA ? bedMaps[colA]!.get(nameA) : undefined
        const rB = nameB ? bedMaps[colB]!.get(nameB) : undefined
        return rA && rB ? { a: rA, b: rB, rowNum } : undefined
      })
      .filter((f): f is BlockRow => f !== undefined)
  }

  // The mate assembly of a band: the target the view passes, or (legacy pairwise
  // config) the sole other entry in assemblyNames.
  private mateAssembly(queryAssembly: string, targetAssemblyName?: string) {
    return (
      targetAssemblyName ??
      (this.getConf('assemblyNames') as string[]).find(n => n !== queryAssembly)
    )
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { blockAssemblies, bedMaps, blockLines } = await this.setup(opts)
    const { assemblyName, targetAssemblyName } = opts
    const col =
      assemblyName === undefined ? -1 : blockAssemblies.indexOf(assemblyName)
    const set = new Set<string>()
    if (col !== -1) {
      const tcol =
        targetAssemblyName === undefined
          ? -1
          : blockAssemblies.indexOf(targetAssemblyName)
      // when a target is given, scope to that pair (rows where both are present);
      // otherwise (e.g. the assembly-swap check) report across all pairs
      if (targetAssemblyName !== undefined && tcol !== -1) {
        for (const { a } of this.buildPairRows(
          col,
          tcol,
          bedMaps,
          blockLines,
        )) {
          set.add(a.refName)
        }
      } else if (targetAssemblyName === undefined) {
        for (const cols of blockLines) {
          const name = cols[col]
          const r = name ? bedMaps[col]!.get(name) : undefined
          if (r) {
            set.add(r.refName)
          }
        }
      }
    }
    return [...set]
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { blockAssemblies, bedMaps, blockLines } = await this.setup(opts)
      const queryAssembly = region.assemblyName
      const mateAssembly = this.mateAssembly(
        queryAssembly,
        opts.targetAssemblyName,
      )
      const colA = blockAssemblies.indexOf(queryAssembly)
      const colB =
        mateAssembly === undefined ? -1 : blockAssemblies.indexOf(mateAssembly)
      if (mateAssembly === undefined || colA === -1 || colB === -1) {
        throw new Error(
          `blockAssemblies ${JSON.stringify(blockAssemblies)} must contain both ${queryAssembly} and ${mateAssembly}, with matching bedLocations`,
        )
      }
      const rows = this.buildPairRows(colA, colB, bedMaps, blockLines)
      for (const feat of makeBlockFeatures(
        [queryAssembly, mateAssembly],
        rows,
        region,
      )) {
        observer.next(feat)
      }
      observer.complete()
    })
  }
}
