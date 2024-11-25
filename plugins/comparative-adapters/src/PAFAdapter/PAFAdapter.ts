import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { MismatchParser } from '@jbrowse/plugin-alignments'

// locals
import SyntenyFeature from '../SyntenyFeature'
import {
  flipCigar,
  swapIndelCigar,
  parsePAFLine,
  parseLineByLine,
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

export default class PAFAdapter extends BaseFeatureDataAdapter {
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
    const pm = this.pluginManager
    const pafLocation = openLocation(this.getConf('pafLocation'), pm)
    const buf = await fetchAndMaybeUnzip(pafLocation, opts)
    return parseLineByLine(buf, parsePAFLine)
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    if (assemblyNames.length === 0) {
      const query = this.getConf('queryAssembly') as string
      const target = this.getConf('targetAssembly') as string
      return [query, target]
    }
    return assemblyNames
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
      const { config } = opts

      // note: this is not the adapter config, it is responding to a display
      // setting passed in via the opts parameter
      if (config && readConfObject(config, 'colorBy') === 'meanQueryIdentity') {
        pafRecords = getWeightedMeans(pafRecords)
      }
      const assemblyNames = this.getAssemblyNames()

      // The index of the assembly name in the query list corresponds to the
      // adapter in the subadapters list
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      const index = assemblyNames.indexOf(assemblyName)

      // if the getFeatures::query is on the query assembly, flip orientation
      // of data
      const flip = index === 0
      if (index === -1) {
        console.warn(`${assemblyName} not found in this adapter`)
        observer.complete()
      }

      for (let i = 0; i < pafRecords.length; i++) {
        const r = pafRecords[i]!
        let start = 0
        let end = 0
        let refName = ''
        let mateName = ''
        let mateStart = 0
        let mateEnd = 0

        if (flip) {
          start = r.qstart
          end = r.qend
          refName = r.qname
          mateName = r.tname
          mateStart = r.tstart
          mateEnd = r.tend
        } else {
          start = r.tstart
          end = r.tend
          refName = r.tname
          mateName = r.qname
          mateStart = r.qstart
          mateEnd = r.qend
        }
        const { extra, strand } = r
        if (refName === qref && doesIntersect2(qstart, qend, start, end)) {
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
              uniqueId: i + assemblyName,
              assemblyName,
              start,
              end,
              type: 'match',
              refName,
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

  freeResources(/* { query } */): void {}
}
