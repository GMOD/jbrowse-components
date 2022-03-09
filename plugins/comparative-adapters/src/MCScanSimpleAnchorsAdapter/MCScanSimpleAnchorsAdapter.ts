import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { GenericFilehandle } from 'generic-filehandle'
import { Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { unzip } from '@gmod/bgzf-filehandle'

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

function parseBed(text: string) {
  return new Map(
    text
      .split('\n')
      .filter(f => !!f || f.startsWith('#'))
      .map(line => {
        const [refName, start, end, name, score, strand] = line.split('\t')
        return [
          name,
          {
            refName,
            start: +start,
            end: +end,
            score: +score,
            name,
            strand: strand === '-' ? -1 : 1,
          },
        ]
      }),
  )
}

async function readFile(file: GenericFilehandle, opts?: BaseOptions) {
  const buffer = (await file.readFile(opts)) as Buffer
  return new TextDecoder('utf8', { fatal: true }).decode(
    isGzip(buffer) ? await unzip(buffer) : buffer,
  )
}

interface BareFeature {
  refName: string
  start: number
  end: number
  score: number
  name: string
}

export default class MCScanAnchorsAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<{
    assemblyNames: string[]
    bed1Location: GenericFilehandle
    bed2Location: GenericFilehandle
    mcscanSimpleAnchorsLocation: GenericFilehandle
    feats: [
      BareFeature,
      BareFeature,
      BareFeature,
      BareFeature,
      number,
      number,
      number,
    ][]
  }>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }
  async setupPre(opts: BaseOptions) {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    const bed1Location = openLocation(
      this.getConf('bed1Location'),
      this.pluginManager,
    )
    const bed2Location = openLocation(
      this.getConf('bed2Location'),
      this.pluginManager,
    )
    const mcscanSimpleAnchorsLocation = openLocation(
      this.getConf('mcscanSimpleAnchorsLocation'),
      this.pluginManager,
    )

    const bed1Map = parseBed(await readFile(bed1Location, opts))
    const bed2Map = parseBed(await readFile(bed2Location, opts))
    const text = await readFile(mcscanSimpleAnchorsLocation, opts)
    const feats = text
      .split('\n')
      .filter(f => !!f && f !== '###')
      .map((line, index) => {
        // the order of assemblyNames is right-col, left-col, hence the name2 then name1
        const [name1_1, name1_2, name2_1, name2_2, score, strand] =
          line.split('\t')
        const r1_1 = bed1Map.get(name1_1)
        const r1_2 = bed1Map.get(name1_2)
        const r2_1 = bed2Map.get(name2_1)
        const r2_2 = bed2Map.get(name2_2)
        if (!r1_1 || !r1_2 || !r2_1 || !r2_2) {
          throw new Error(
            `feature not found, ${name1_1} ${name1_2} ${name2_1} ${name2_2} ${r1_1} ${r1_2} ${r2_1} ${r2_2}`,
          )
        }
        return [
          r1_1,
          r1_2,
          r2_1,
          r2_2,
          +score,
          strand === '-' ? -1 : 1,
          index,
        ] as [
          BareFeature,
          BareFeature,
          BareFeature,
          BareFeature,
          number,
          number,
          number,
        ]
      })

    return {
      assemblyNames,
      bed1Location,
      bed2Location,
      mcscanSimpleAnchorsLocation,
      feats,
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseFeatureDataAdapter filters it out)
    return true
  }

  async getRefNames() {
    // we cannot determine this accurately
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { assemblyNames, feats } = await this.setup(opts)

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        feats.forEach(f => {
          const [f0_1, f0_2, f1_1, f1_2, score, strand, rowNum] = f
          let r1 = {
            refName: f0_1.refName,
            start: Math.min(f0_1.start, f0_2.start),
            end: Math.max(f0_1.end, f0_2.end),
          }
          let r2 = {
            refName: f1_1.refName,
            start: Math.min(f1_1.start, f1_2.start),
            end: Math.max(f1_1.end, f1_2.end),
          }
          if (index === 1) {
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
                score,
                strand,
                mate: r2 as BareFeature,
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
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
