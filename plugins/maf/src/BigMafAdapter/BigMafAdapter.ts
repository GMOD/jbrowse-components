import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { getSnapshot } from 'mobx-state-tree'
import { firstValueFrom, toArray } from 'rxjs'

import parseNewick from '../parseNewick'
import { normalize } from '../util'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

interface OrganismRecord {
  chr: string
  start: number
  srcSize: number
  strand: number
  unknown: number
  seq: string
}
export default class BigMafAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<{ adapter: BaseFeatureDataAdapter }>

  async setup() {
    if (!this.getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    return {
      adapter: (
        await this.getSubAdapter({
          ...getSnapshot(this.config),
          type: 'BigBedAdapter',
        })
      ).dataAdapter as BaseFeatureDataAdapter,
    }
  }
  async setupPre() {
    if (!this.setupP) {
      this.setupP = this.setup().catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async getRefNames() {
    const { adapter } = await this.setup()
    return adapter.getRefNames()
  }

  async getHeader() {
    const { adapter } = await this.setup()
    return adapter.getHeader()
  }

  getFeatures(query: Region, opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { adapter } = await this.setup()
      const features = await updateStatus(
        'Downloading alignments',
        statusCallback,
        () => firstValueFrom(adapter.getFeatures(query).pipe(toArray())),
      )
      await updateStatus('Processing alignments', statusCallback, () => {
        for (const feature of features) {
          const maf = feature.get('mafBlock') as string
          const blocks = maf.split(';')
          let aln: string | undefined
          const alns = [] as string[]
          const alignments = {} as Record<string, OrganismRecord>
          const blocks2 = [] as string[]
          for (const block of blocks) {
            if (block.startsWith('s')) {
              if (aln) {
                alns.push(block.split(/ +/)[6]!)
                blocks2.push(block)
              } else {
                aln = block.split(/ +/)[6]
                alns.push(aln!)
                blocks2.push(block)
              }
            }
          }

          for (let i = 0; i < blocks2.length; i++) {
            const elt = blocks2[i]!
            const ad = elt.split(/ +/)
            const y = ad[1]!.split('.')
            const org = y[0]!
            const chr = y[1]!

            alignments[org] = {
              chr: chr,
              start: +ad[1]!,
              srcSize: +ad[2]!,
              strand: ad[3] === '+' ? 1 : -1,
              unknown: +ad[4]!,
              seq: alns[i]!,
            }
          }
          observer.next(
            new SimpleFeature({
              id: feature.id(),
              data: {
                start: feature.get('start'),
                end: feature.get('end'),
                refName: feature.get('refName'),
                seq: alns[0],
                alignments: alignments,
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
