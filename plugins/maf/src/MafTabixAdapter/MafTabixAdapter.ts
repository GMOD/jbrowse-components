import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  Feature,
  Region,
  SimpleFeature,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSnapshot } from 'mobx-state-tree'
import { firstValueFrom, toArray } from 'rxjs'

import parseNewick from '../parseNewick'
import { normalize } from '../util'

interface OrganismRecord {
  chr: string
  start: number
  srcSize: number
  strand: number
  unknown: number
  seq: string
}

export default class MafTabixAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

  async setupPre() {
    if (!this.getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    return {
      adapter: (
        await this.getSubAdapter({
          ...getSnapshot(this.config),
          type: 'BedTabixAdapter',
        })
      ).dataAdapter as BaseFeatureDataAdapter,
    }
  }
  async setupPre2() {
    if (!this.setupP) {
      this.setupP = this.setupPre().catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async setup(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.setupPre2(),
    )
  }

  async getRefNames(opts?: BaseOptions) {
    const { adapter } = await this.setup(opts)
    return adapter.getRefNames()
  }

  async getHeader(opts?: BaseOptions) {
    const { adapter } = await this.setup(opts)
    return adapter.getHeader()
  }

  getFeatures(query: Region, opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { adapter } = await this.setup(opts)
      const features = await updateStatus(
        'Downloading alignments',
        statusCallback,
        () => firstValueFrom(adapter.getFeatures(query).pipe(toArray())),
      )

      await updateStatus('Processing alignments', statusCallback, () => {
        let firstAssemblyNameFound = ''
        const refAssemblyName = this.getConf('refAssemblyName')
        for (const feature of features) {
          const data = (feature.get('field5') as string).split(',')
          const alignments = {} as Record<string, OrganismRecord>

          const len = data.length
          for (let j = 0; j < len; j++) {
            const elt = data[j]!
            const seq = elt.split(':')[5]!
            const ad = elt.split(':')
            const ag = ad[0]!.split('.')
            const [n1, n2 = '', ...rest] = ag
            let assemblyName
            let last = ''
            if (ag.length === 2) {
              assemblyName = n1
              last = n2!
            } else if (!Number.isNaN(+n2)) {
              assemblyName = `${n1}.${n2}`
              last = rest.join('.')
            } else {
              assemblyName = n1
              last = [n2, ...rest].join('.')
            }
            if (assemblyName) {
              firstAssemblyNameFound = firstAssemblyNameFound || assemblyName

              alignments[assemblyName] = {
                chr: last,
                start: +ad[1]!,
                srcSize: +ad[2]!,
                strand: ad[3] === '-' ? -1 : 1,
                unknown: +ad[4]!,
                seq,
              }
            }
          }

          observer.next(
            new SimpleFeature({
              id: feature.id(),
              data: {
                start: feature.get('start'),
                end: feature.get('end'),
                refName: feature.get('refName'),
                name: feature.get('name'),
                score: feature.get('score'),
                alignments,
                seq:
                  alignments[refAssemblyName || query.assemblyName]?.seq ||
                  alignments[firstAssemblyNameFound]?.seq,
              },
            }),
          )
        }
      })
      observer.complete()
    })
  }

  async getSamples(_query: Region) {
    const nhLoc = this.getConf('nhLocation')
    const nh =
      nhLoc.uri === '/path/to/my.nh'
        ? undefined
        : await openLocation(nhLoc).readFile('utf8')

    // TODO: we may need to resolve the exact set of rows in the visible region
    // here
    return {
      samples: normalize(this.getConf('samples')),
      tree: nh ? parseNewick(nh) : undefined,
    }
  }

  freeResources(): void {}
}
