import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { doesIntersect2 } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { readFile, parseBed } from '../util'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

interface BareFeature {
  refName: string
  start: number
  end: number
  score: number
  name: string
}

type Row = [
  BareFeature,
  BareFeature,
  BareFeature,
  BareFeature,
  number,
  number,
  number,
]

export default class MCScanAnchorsAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<{
    assemblyNames: string[]
    feats: Row[]
  }>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }
  async setupPre(opts: BaseOptions) {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    const pm = this.pluginManager
    const bed1 = openLocation(this.getConf('bed1Location'), pm)
    const bed2 = openLocation(this.getConf('bed2Location'), pm)
    const mcscan = openLocation(this.getConf('mcscanSimpleAnchorsLocation'), pm)
    const [bed1text, bed2text, mcscantext] = await Promise.all(
      [bed1, bed2, mcscan].map(r => readFile(r, opts)),
    )
    const bed1Map = parseBed(bed1text!)
    const bed2Map = parseBed(bed2text!)
    const feats = mcscantext!
      .split(/\n|\r\n|\r/)
      .filter(f => !!f && f !== '###')
      .map((line, index) => {
        const [n11, n12, n21, n22, score, strand] = line.split('\t')
        const r11 = bed1Map.get(n11)
        const r12 = bed1Map.get(n12)
        const r21 = bed2Map.get(n21)
        const r22 = bed2Map.get(n22)
        if (!r11 || !r12 || !r21 || !r22) {
          throw new Error(
            `feature not found, ${n11} ${n12} ${n21} ${n22} ${r11} ${r12} ${r21} ${r22}`,
          )
        }
        return [
          r11,
          r12,
          r21,
          r22,
          +score!,
          strand === '-' ? -1 : 1,
          index,
        ] as Row
      })

    return {
      assemblyNames,
      feats,
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseFeatureDataAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    return assemblyNames
  }

  async getRefNames(opts: BaseOptions = {}) {
    // @ts-expect-error
    const r1 = opts.regions?.[0].assemblyName
    const { feats } = await this.setup(opts)

    const idx = this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (const feat of feats) {
        if (idx === 0) {
          set.add(feat[0].refName)
          set.add(feat[1].refName)
        } else {
          set.add(feat[2].refName)
          set.add(feat[3].refName)
        }
      }
      return [...set]
    }
    console.warn('Unable to do ref renaming on adapter')
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { assemblyNames, feats } = await this.setup(opts)

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        const flip = index === 0
        feats.forEach(f => {
          const [f11, f12, f21, f22, score, strand, rowNum] = f
          let r1 = {
            refName: f11.refName,
            start: Math.min(f11.start, f12.start),
            end: Math.max(f11.end, f12.end),
          }
          let r2 = {
            refName: f21.refName,
            start: Math.min(f21.start, f22.start),
            end: Math.max(f21.end, f22.end),
          }
          if (!flip) {
            ;[r2, r1] = [r1, r2]
          }
          if (
            r1.refName === region.refName &&
            doesIntersect2(r1.start, r1.end, region.start, region.end)
          ) {
            observer.next(
              new SimpleFeature({
                ...r1,
                uniqueId: `${rowNum}`,
                syntenyId: rowNum,
                assemblyName: assemblyNames[+!flip],
                score,
                strand,
                mate: {
                  ...r2,
                  assemblyName: assemblyNames[+flip],
                },
              }),
            )
          }
        })
      }

      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the foreseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
