import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { MismatchParser } from '@jbrowse/plugin-alignments'

import SyntenyFeature from '../SyntenyFeature'
import {
  flipCigar,
  parseLineByLine,
  parsePAFLine,
  swapIndelCigar,
} from '../util'
import { getWeightedMeans } from './util'

import type { PAFRecord } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

const { parseCigar } = MismatchParser

interface PAFOptions extends BaseOptions {
  config?: AnyConfigurationModel
}

export default class AllVsAllPAFAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<PAFRecord[]>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async setupPre(opts?: BaseOptions) {
    return parseLineByLine(
      await fetchAndMaybeUnzip(
        openLocation(this.getConf('pafLocation'), this.pluginManager),
        opts,
      ),
      parsePAFLine,
      opts,
    )
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    return this.getConf('assemblyNames') as string[]
  }

  async getRefNames(opts: BaseOptions = {}) {
    // @ts-expect-error
    const r1 = opts.regions?.[0].assemblyName
    const feats = await this.setup(opts)

    const idx = this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (const feat of feats) {
        set.add(idx === 0 ? feat.qname : feat.tname)
      }
      return [...set]
    }
    console.warn('Unable to do ref renaming on adapter')
    return []
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      let pafRecords = await this.setup(opts)

      // note: this is not the adapter config, it is responding to a display
      // setting passed in via the opts parameter
      if (
        opts.config &&
        readConfObject(opts.config, 'colorBy') === 'meanQueryIdentity'
      ) {
        pafRecords = getWeightedMeans(pafRecords)
      }
      const assemblyNames = this.getAssemblyNames()

      // The index of the assembly name in the query list corresponds to the
      // adapter in the subadapters list
      const index = assemblyNames.indexOf(query.assemblyName)

      // if the getFeatures::query is on the query assembly, flip orientation
      // of data
      const flip = index === 0
      if (index === -1) {
        console.warn(`${query.assemblyName} not found in this adapter`)
        observer.complete()
      }

      const len = pafRecords.length
      for (let i = 0; i < len; i++) {
        const currentPafRecord = pafRecords[i]!
        let start = 0
        let end = 0
        let refName = ''
        let mateName = ''
        let mateStart = 0
        let mateEnd = 0

        if (flip) {
          start = currentPafRecord.qstart
          end = currentPafRecord.qend
          refName = currentPafRecord.qname
          mateName = currentPafRecord.tname
          mateStart = currentPafRecord.tstart
          mateEnd = currentPafRecord.tend
        } else {
          start = currentPafRecord.tstart
          end = currentPafRecord.tend
          refName = currentPafRecord.tname
          mateName = currentPafRecord.qname
          mateStart = currentPafRecord.qstart
          mateEnd = currentPafRecord.qend
        }
        const { extra, strand } = currentPafRecord
        const refName2 = refName.replace(`${query.assemblyName}#1#`, '')
        if (
          refName2 === query.refName &&
          doesIntersect2(query.start, query.end, start, end)
        ) {
          const { numMatches = 0, blockLen = 1, cg, ...rest } = extra

          let CIGAR = extra.cg
          if (extra.cg) {
            if (flip && strand === -1) {
              CIGAR = flipCigar(parseCigar(extra.cg)).join('')
            } else if (flip) {
              CIGAR = swapIndelCigar(extra.cg)
            }
          }

          observer.next(
            new SyntenyFeature({
              uniqueId: i + query.assemblyName,
              assemblyName: query.assemblyName,
              start,
              end,
              type: 'match',
              refName: refName2,
              strand,
              ...rest,
              CIGAR,
              syntenyId: i,
              identity: numMatches / blockLen,
              numMatches,
              blockLen,
              mate: {
                start: mateStart,
                end: mateEnd,
                refName: mateName,
                assemblyName: assemblyNames[+flip],
              },
            }),
          )
        }
      }

      observer.complete()
    })
  }
}
