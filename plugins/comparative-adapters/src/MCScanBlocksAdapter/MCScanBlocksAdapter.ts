import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, doesIntersect2, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { parseBed, readFile } from '../util.ts'

import type { MCScanBlocksAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, FileLocation, Region  } from '@jbrowse/core/util'

interface BareFeature {
  strand: number
  refName: string
  start: number
  end: number
  score: number
  name: string
}

type Row = [BareFeature, BareFeature, number]

// The blocks file has one column per genome; this track renders assemblyNames
// [a, b], so we pull columns colA/colB and emit a link for every row where both
// have a gene (neither is '.'). blockAssemblies names the columns in order.
export default class MCScanBlocksAdapter extends BaseFeatureDataAdapter<MCScanBlocksAdapterConfig> {
  private setupP?: Promise<{
    assemblyNames: string[]
    feats: Row[]
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
    const assemblyNames = this.getConf('assemblyNames') as string[]
    const blockAssemblies = this.getConf('blockAssemblies') as string[]
    const bedLocations = this.getConf('bedLocations') as FileLocation[]

    const colA = blockAssemblies.indexOf(assemblyNames[0]!)
    const colB = blockAssemblies.indexOf(assemblyNames[1]!)
    const bedA = bedLocations[colA]
    const bedB = bedLocations[colB]
    if (colA === -1 || colB === -1 || !bedA || !bedB) {
      throw new Error(
        `blockAssemblies ${JSON.stringify(blockAssemblies)} must contain both of assemblyNames ${JSON.stringify(assemblyNames)} with a matching bedLocations entry`,
      )
    }

    const pm = this.pluginManager
    const blocks = openLocation(this.getConf('mcscanBlocksLocation'), pm)
    const [bedAtext, bedBtext, blockstext] = await updateStatus(
      'Downloading data',
      statusCallback,
      () =>
        Promise.all(
          [openLocation(bedA, pm), openLocation(bedB, pm), blocks].map(r =>
            readFile(r, opts),
          ),
        ),
    )

    const bedAMap = parseBed(bedAtext!)
    const bedBMap = parseBed(bedBtext!)
    const feats = blockstext!
      .split(/\n|\r\n|\r/)
      .filter(f => !!f)
      .map((line, index) => {
        const cols = line.split('\t')
        const nameA = cols[colA]
        const nameB = cols[colB]
        const rA = nameA ? bedAMap.get(nameA) : undefined
        const rB = nameB ? bedBMap.get(nameB) : undefined
        return rA && rB ? ([rA, rB, index] as Row) : undefined
      })
      .filter((f): f is Row => f !== undefined)

    return {
      assemblyNames,
      feats,
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseFeatureDataAdapter filters it out)
    return true
  }

  async getRefNames(opts: BaseOptions = {}) {
    const r1 = opts.assemblyName
    const { feats, assemblyNames } = await this.setup(opts)

    const idx = r1 === undefined ? -1 : assemblyNames.indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (const feat of feats) {
        set.add(idx === 0 ? feat[0].refName : feat[1].refName)
      }
      return [...set]
    }
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { assemblyNames, feats } = await this.setup(opts)

      // The index of the assembly name in the region list corresponds to the
      // side (colA/colB) that faces this region
      const index = assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        const flip = index === 0
        for (const f of feats) {
          const [rA, rB, rowNum] = f
          const [f1, f2] = !flip ? [rB, rA] : [rA, rB]
          if (
            f1.refName === region.refName &&
            doesIntersect2(region.start, region.end, f1.start, f1.end)
          ) {
            observer.next(
              new SimpleFeature({
                ...f1,
                uniqueId: `${index}-${rowNum}`,
                syntenyId: rowNum,

                // -1 when the paired genes are on opposite strands (inverted)
                strand: f1.strand * f2.strand,
                assemblyName: assemblyNames[+!flip],
                mate: {
                  ...f2,
                  assemblyName: assemblyNames[+flip],
                },
              }),
            )
          }
        }
      }

      observer.complete()
    })
  }
}
