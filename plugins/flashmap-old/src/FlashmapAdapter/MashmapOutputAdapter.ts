import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  FileLocation,
  NoAssemblyRegion,
  Region,
} from '@jbrowse/core/util/types'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { GenericFilehandle } from 'generic-filehandle'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import AbortablePromiseCache from 'abortable-promise-cache'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import { MashmapOutputSchema } from './configSchema'

interface MashmapRecord {
  records: NoAssemblyRegion[]
  extra: {
    mappingIdentity: number
    strand: string
  }
}

export default class MashmapOutputAdapter extends BaseFeatureDataAdapter {
  private cache = new AbortablePromiseCache({
    cache: new QuickLRU({ maxSize: 1 }),
    fill: (data: BaseOptions, signal?: AbortSignal) => {
      return this.setup({ ...data, signal })
    },
  })

  private assemblyNames: string[]

  private outLocation: GenericFilehandle

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: Instance<typeof MashmapOutputSchema>) {
    super(config)
    const outLocation = readConfObject(config, 'outLocation') as FileLocation
    const assemblyNames = readConfObject(config, 'assemblyNames') as string[]
    this.outLocation = openLocation(outLocation)
    this.assemblyNames = assemblyNames
  }

  async setup(opts?: BaseOptions) {
    const text = (await this.outLocation.readFile({
      encoding: 'utf8',
      ...opts,
    })) as string
    const mashmapRecords: MashmapRecord[] = []
    text.split('\n').forEach((line: string, index: number) => {
      if (line.length) {
        const [
          queryName,
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          queryRefSeqLen,
          start1,
          end1,
          strand,
          targetName,
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          targetRefSeqLen,
          start2,
          end2,
          mappingIdentity,
          ...fields
        ] = line.split('\t')

        const rest = Object.fromEntries(
          fields.map((field) => {
            const r = field.indexOf(':')
            const fieldName = field.slice(0, r)
            const fieldValue = field.slice(r + 3)
            return [fieldName, fieldValue]
          }),
        )

        mashmapRecords[index] = {
          records: [
            { refName: queryName, start: +start1, end: +end1 },
            { refName: targetName, start: +start2, end: +end2 },
          ],
          extra: {
            strand,
            mappingIdentity: +mappingIdentity,
            ...rest,
          },
        }
      }
    })
    return mashmapRecords
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
    return ObservableCreate<Feature>(async (observer) => {
      const mashmapRecords = await this.cache.get(
        'initialize',
        opts,
        opts.signal,
      )

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = this.assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        for (let i = 0; i < mashmapRecords.length; i++) {
          const { extra, records } = mashmapRecords[i]
          const { start, end, refName } = records[index]
          if (records[index].refName === region.refName) {
            if (doesIntersect2(region.start, region.end, start, end)) {
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
      }

      observer.complete()
    })
  }

  freeResources(/* { region } */): void {}
}
