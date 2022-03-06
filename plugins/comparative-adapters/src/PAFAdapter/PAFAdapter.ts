import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { unzip } from '@gmod/bgzf-filehandle'

export interface PAFRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
  extra: {
    blockLen: number
    mappingQual: number
    numMatches: number
  }
}

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<PAFRecord[]>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async setupPre(opts?: BaseOptions) {
    const pafLocation = openLocation(
      readConfObject(this.config, 'pafLocation'),
      this.pluginManager,
    )
    const buffer = (await pafLocation.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)

    // mashmap produces PAF-like data that is space separated instead of tab
    const hasTab = text.indexOf('\t')
    const splitChar = hasTab !== -1 ? '\t' : ' '
    return text
      .split('\n')
      .filter(line => !!line)
      .map(line => {
        const [
          qname,
          ,
          qstart,
          qend,
          strand,
          tname,
          ,
          tstart,
          tend,
          numMatches,
          blockLen,
          mappingQual,
          ...fields
        ] = line.split(splitChar)

        const rest = Object.fromEntries(
          fields.map(field => {
            const r = field.indexOf(':')
            const fieldName = field.slice(0, r)
            const fieldValue = field.slice(r + 3)
            return [fieldName, fieldValue]
          }),
        )

        return {
          tname,
          tstart: +tstart,
          tend: +tend,
          qname,
          qstart: +qstart,
          qend: +qend,
          strand: strand === '-' ? -1 : 1,
          extra: {
            numMatches: +numMatches,
            blockLen: +blockLen,
            mappingQual: +mappingQual,
            ...rest,
          },
        }
      })
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    let assemblyNames = readConfObject(this.config, 'assemblyNames') as string[]
    if (assemblyNames.length === 0) {
      const query = readConfObject(this.config, 'queryAssembly') as string
      const target = readConfObject(this.config, 'targetAssembly') as string
      assemblyNames = [query, target]
    }
    return assemblyNames
  }

  async getRefNames(opts: BaseOptions = {}) {
    // @ts-ignore
    const r1 = opts.regions?.[0].assemblyName
    const feats = await this.setup()

    const idx = this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (let i = 0; i < feats.length; i++) {
        set.add(feats[i].tname)
      }
      return Array.from(set)
    }
    console.warn('Unable to do ref renaming on adapter')
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const pafRecords = await this.setup(opts)
      const assemblyNames = this.getAssemblyNames()
      const { assemblyName } = region

      // The index of the assembly name in the region list corresponds to the
      // adapter in the subadapters list
      const index = (assemblyNames.indexOf(assemblyName) + 1) % 2
      if (index !== -1) {
        for (let i = 0; i < pafRecords.length; i++) {
          const { extra, tname, strand, tstart, tend, qname, qstart, qend } =
            pafRecords[i]

          if (
            tname === region.refName &&
            doesIntersect2(region.start, region.end, tstart, tend)
          ) {
            observer.next(
              new SimpleFeature({
                uniqueId: `${i}`,
                start: tstart,
                end: tend,
                refName: tname,
                strand: strand,
                assemblyName,
                syntenyId: i,
                mate: { start: qstart, end: qend, refName: qname },
                ...extra,
              }),
            )
          }
        }
      }

      observer.complete()
    })
  }

  freeResources(/* { region } */): void {}
}
