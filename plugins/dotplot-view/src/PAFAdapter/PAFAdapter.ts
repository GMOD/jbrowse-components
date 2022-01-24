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
import MyConfigSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

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
  private cache = new AbortablePromiseCache({
    cache: new QuickLRU({ maxSize: 1 }),
    fill: (data: BaseOptions, signal?: AbortSignal) => {
      return this.setup({ ...data, signal })
    },
  })

  private assemblyNames: string[]

  private pafLocation: GenericFilehandle

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pafLocation = readConfObject(config, 'pafLocation') as FileLocation
    const assemblyNames = readConfObject(config, 'assemblyNames') as string[]
    this.pafLocation = openLocation(pafLocation, this.pluginManager)
    this.assemblyNames = assemblyNames
  }

  async setup(opts?: BaseOptions) {
    const text = await this.pafLocation.readFile({
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
      const pafRecords = await this.cache.get('initialize', opts, opts.signal)

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = this.assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        for (let i = 0; i < pafRecords.length; i++) {
          const { extra, records } = pafRecords[i]
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
