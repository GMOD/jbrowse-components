import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion, Region } from '@jbrowse/core/util/types'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'

interface PafRecord {
  records: NoAssemblyRegion[]
  extra: {
    blockLen: number
    mappingQual: number
    numMatches: number
    strand: number
  }
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<PafRecord[]>

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
    const text = await pafLocation.readFile({
      encoding: 'utf8',
      ...opts,
    })

    // mashmap produces PAF-like data that is space separated instead of tab
    const hasTab = text.indexOf('\t')
    const splitChar = hasTab !== -1 ? '\t' : ' '
    return text
      .split('\n')
      .filter(line => !!line)
      .map(line => {
        const [
          chr1,
          ,
          start1,
          end1,
          strand,
          chr2,
          ,
          start2,
          end2,
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
          records: [
            { refName: chr1, start: +start1, end: +end1 },
            { refName: chr2, start: +start2, end: +end2 },
          ],
          extra: {
            numMatches: +numMatches,
            blockLen: +blockLen,
            strand: strand === '-' ? -1 : 1,
            mappingQual: +mappingQual,
            ...rest,
          },
        } as PafRecord
      })
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  async getRefNames() {
    // we cannot determine this accurately
    return []
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const pafRecords = await this.setup(opts)
      const assemblyNames = readConfObject(this.config, 'assemblyNames')

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        for (let i = 0; i < pafRecords.length; i++) {
          const { extra, records } = pafRecords[i]
          const { start, end, refName } = records[index]
          if (
            records[index].refName === region.refName &&
            doesIntersect2(region.start, region.end, start, end)
          ) {
            observer.next(
              new SimpleFeature({
                uniqueId: `row_${i}`,
                start,
                end,
                refName,
                syntenyId: i,
                mate: {
                  start: records[+!index].start,
                  end: records[+!index].end,
                  refName: records[+!index].refName,
                },
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
