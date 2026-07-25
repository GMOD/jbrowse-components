import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createSharedSetup } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { collectLines, getAssemblyNamesFromConf, parsePAFLine } from '../util.ts'
import {
  loadPafRecords,
  makeSyntenyFeature,
  orientPafRecord,
} from './util.ts'

import type { PAFRecord } from './util.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export function parsePafBuffer(buffer: Uint8Array, opts?: BaseOptions) {
  return collectLines({
    buffer,
    label: 'Parsing PAF',
    parseLine: parsePAFLine,
    opts,
  })
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  // One download+parse shared by every display on this track, reporting to
  // whichever of them is currently waiting. Subclasses (delta, chain, MashMap)
  // override setupPre alone.
  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

  async setupPre(opts?: BaseOptions): Promise<PAFRecord[]> {
    return loadPafRecords({
      file: openLocation(this.getConf('pafLocation'), this.pluginManager),
      parse: parsePafBuffer,
      opts,
    })
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    return getAssemblyNamesFromConf(this)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const r1 = opts.assemblyName
    const feats = await this.setup(opts)

    const idx = r1 === undefined ? -1 : this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (const feat of feats) {
        set.add(idx === 0 ? feat.qname : feat.tname)
      }
      return [...set]
    }
    return []
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const pafRecords = await this.setup(opts)

      // note: this is not the adapter config, it is responding to a display
      // setting passed in via the opts parameter
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
      } else {
        for (let i = 0; i < pafRecords.length; i++) {
          const record = pafRecords[i]!
          const { refName, start, end, mateRefName, mateStart, mateEnd } =
            orientPafRecord(record, flip)
          if (refName === qref && doesIntersect2(qstart, qend, start, end)) {
            observer.next(
              makeSyntenyFeature({
                syntenyId: i,
                assemblyName,
                refName,
                start,
                end,
                strand: record.strand,
                extra: record.extra,
                flip,
                mate: {
                  start: mateStart,
                  end: mateEnd,
                  refName: mateRefName,
                  assemblyName: assemblyNames[+flip]!,
                },
              }),
            )
          }
        }
      }

      observer.complete()
    })
  }
}
