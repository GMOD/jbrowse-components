import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createSharedSetup } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { joinBedPair, makeBlockFeatures } from '../mcscanUtil.ts'
import { parseBed, readFiles } from '../util.ts'

import type { BareFeature, BlockRow } from '../mcscanUtil.ts'
import type { MCScanBlocksAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

// A table where no row resolves on any pair of columns is a misconfiguration,
// and overwhelmingly one particular misconfiguration: blockAssemblies and
// bedLocations are positional against the FILE's column order, so a config
// listing them in the order the genomes are displayed in, or the order they
// were passed to whatever wrote the table, looks every gene up in another
// genome's BED. That resolved nothing and drew an empty track, which is
// indistinguishable from a region with no orthologs in it.
//
// Scoped to the whole table rather than to one pair on purpose: two particular
// genomes filling no common row is possible, a table filling none anywhere is
// not. Stops at the first row that joins, so a healthy file pays for one row.
function checkAnyColumnsJoined(
  blockLines: string[][],
  bedMaps: Map<string, BareFeature>[],
  blockAssemblies: string[],
) {
  for (const cols of blockLines) {
    let joined = 0
    for (let i = 0; i < bedMaps.length; i++) {
      const name = cols[i]
      if (name && bedMaps[i]!.has(name) && ++joined > 1) {
        return
      }
    }
  }
  if (blockLines.length > 0) {
    throw new Error(
      `none of the ${blockLines.length} rows in this .blocks file name genes present in two of its BED files; blockAssemblies ${JSON.stringify(blockAssemblies)} and bedLocations have to be in the file's own column order, which is not necessarily the order assemblyNames lists`,
    )
  }
}

// A .blocks file has one column per genome (column 0 is the reference). Because
// it describes N genomes at once, one track can back every band of a multi-way
// view: parse all columns + BEDs once, then resolve which pair to draw per query
// from the queried assembly and the band's target assembly. A given band draws
// the pair (query assembly, target assembly); a query with no target — a plain
// LGVSyntenyDisplay, or the region launch asking what a locus aligns to — draws
// every pair the track declares, which for a legacy 2-entry assemblyNames config
// is the same single mate it always was.
export default class MCScanBlocksAdapter extends BaseFeatureDataAdapter<MCScanBlocksAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

  async setupPre(opts: BaseOptions) {
    const blockAssemblies = this.getConf('blockAssemblies')
    const bedLocations = this.getConf('bedLocations') as FileLocation[]
    // one BED per column, all present: caught here so a misconfigured track
    // fails with the offending column rather than an opaque openLocation error
    // deep in the download
    if (bedLocations.length !== blockAssemblies.length) {
      throw new Error(
        `MCScanBlocksAdapter: blockAssemblies lists ${blockAssemblies.length} columns but bedLocations has ${bedLocations.length}; supply exactly one BED per column`,
      )
    }
    const missing = blockAssemblies.filter((_, i) => !bedLocations[i])
    if (missing.length) {
      throw new Error(
        `MCScanBlocksAdapter: missing BED file for column(s) ${missing.join(', ')}; each genome column needs its BED`,
      )
    }
    const pm = this.pluginManager
    const [blockstext, ...bedtexts] = await readFiles(
      [
        openLocation(this.getConf('mcscanBlocksLocation'), pm),
        ...bedLocations.map(b => openLocation(b, pm)),
      ],
      opts,
    )
    const bedMaps = bedtexts.map(t => parseBed(t))
    const blockLines = blockstext!
      .split(/\n|\r\n|\r/)
      .filter(f => !!f)
      .map(l => l.split('\t'))
    checkAnyColumnsJoined(blockLines, bedMaps, blockAssemblies)
    return { blockAssemblies, bedMaps, blockLines }
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
        const pair = joinBedPair(
          bedMaps[colA]!,
          bedMaps[colB]!,
          cols[colA],
          cols[colB],
        )
        return pair === undefined
          ? undefined
          : { ...pair, rowNum, strand: pair.a.strand * pair.b.strand }
      })
      .filter((f): f is BlockRow => f !== undefined)
  }

  // The columns a query draws against: the single band target when a view
  // passes one, otherwise every other assembly the track declares.
  //
  // "No target" means "what aligns here at all", which is the answer the
  // all-vs-all adapters already give and what an LGVSyntenyDisplay and the
  // region-launch mate discovery ask for. Collapsing it to one arbitrary column
  // left a three-genome table drawing only its first pair in both places, with
  // no sign that the rest of the table existed. A track pinned to a pair (two
  // entries in assemblyNames, the legacy shape) is unaffected — that list is
  // what bounds this.
  private mateAssemblies(queryAssembly: string, targetAssemblyName?: string) {
    return targetAssemblyName === undefined
      ? this.getConf('assemblyNames').filter(n => n !== queryAssembly)
      : [targetAssemblyName]
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
      const mateAssemblies = this.mateAssemblies(
        queryAssembly,
        opts.targetAssemblyName,
      )
      const colA = blockAssemblies.indexOf(queryAssembly)
      if (colA === -1 || !mateAssemblies.length) {
        throw new Error(
          `blockAssemblies ${JSON.stringify(blockAssemblies)} must contain ${queryAssembly}, and assemblyNames must name another assembly to draw it against`,
        )
      }
      for (const mateAssembly of mateAssemblies) {
        const colB = blockAssemblies.indexOf(mateAssembly)
        if (colB === -1) {
          throw new Error(
            `blockAssemblies ${JSON.stringify(blockAssemblies)} must contain both ${queryAssembly} and ${mateAssembly}, with matching bedLocations`,
          )
        }
        const rows = this.buildPairRows(colA, colB, bedMaps, blockLines)
        // the mate column keys the ids apart, so the same source row joined to
        // two different genomes stays two features
        for (const feat of makeBlockFeatures(
          [queryAssembly, mateAssembly],
          rows,
          region,
          `${colB}-`,
        )) {
          observer.next(feat)
        }
      }
      observer.complete()
    })
  }
}
