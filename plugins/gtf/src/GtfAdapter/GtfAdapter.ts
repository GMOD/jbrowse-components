/* eslint-disable no-underscore-dangle */
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { readConfObject } from '@jbrowse/core/configuration'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import IntervalTree from '@flatten-js/interval-tree'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { unzip } from '@gmod/bgzf-filehandle'

import gtf from '@gmod/gtf'
import { FeatureLoc, featureData } from '../util'
function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class extends BaseFeatureDataAdapter {
  protected gtfFeatures?: Promise<Record<string, IntervalTree>>

  private async loadData() {
    if (!this.gtfFeatures) {
      this.gtfFeatures = openLocation(
        readConfObject(this.config, 'gtfLocation'),
        this.pluginManager,
      )
        .readFile()
        .then(async buffer => {
          const buf = isGzip(buffer as Buffer) ? await unzip(buffer) : buffer
          // 512MB  max chrome string length is 512MB
          if (buf.length > 536_870_888) {
            throw new Error('Data exceeds maximum string length (512MB)')
          }
          return new TextDecoder('utf8', { fatal: true }).decode(buf)
        })
        .then(
          data =>
            gtf.parseStringSync(data, {
              parseFeatures: true,
              parseComments: false,
              parseDirectives: false,
              parseSequences: false,
            }) as FeatureLoc[][],
        )

        .then(feats =>
          feats
            .flat()
            .map(
              (f, i) =>
                new SimpleFeature({
                  data: featureData(f),
                  id: `${this.id}-offset-${i}`,
                }),
            )
            .reduce((acc, obj) => {
              const key = obj.get('refName')
              if (!acc[key]) {
                acc[key] = new IntervalTree()
              }
              acc[key].insert([obj.get('start'), obj.get('end')], obj)
              return acc
            }, {} as Record<string, IntervalTree>),
        )
        .catch(e => {
          this.gtfFeatures = undefined
          throw e
        })
    }

    return this.gtfFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const gtfFeatures = await this.loadData()
    return Object.keys(gtfFeatures)
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const gtfFeatures = await this.loadData()
        gtfFeatures[refName]
          ?.search([start, end])
          .forEach(f => observer.next(f))
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

//   private featureData(data: FeatureLoc) {
//     const f: Record<string, unknown> = { ...data }
//     ;(f.start as number) -= 1 // convert to interbase
//     f.strand = { '+': 1, '-': -1, '.': 0, '?': undefined }[data.strand] // convert strand
//     f.phase = Number(data.frame)
//     f.refName = data.seq_name
//     if (data.score === null) {
//       delete f.score
//     }
//     if (data.frame === null) {
//       delete f.score
//     }
//     const defaultFields = [
//       'start',
//       'end',
//       'seq_name',
//       'score',
//       'featureType',
//       'source',
//       'frame',
//       'strand',
//     ]
//     Object.keys(data.attributes).forEach(a => {
//       let b = a.toLowerCase()
//       if (defaultFields.includes(b)) {
//         // add "suffix" to tag name if it already exists
//         // reproduces behavior of NCList
//         b += '2'
//       }
//       if (data.attributes[a] !== null) {
//         let attr = data.attributes[a]
//         if (Array.isArray(attr) && attr.length === 1) {
//           // gtf uses double quotes for text values in the attributes column, remove them
//           const formattedAttr = attr[0].replace(/^"|"$/g, '')
//           attr = formattedAttr
//         }
//         f[b] = attr
//       }
//     })
//     f.refName = f.seq_name
//     f.type = f.featureType

//     // the SimpleFeature constructor takes care of recursively inflating subfeatures
//     if (data.child_features && data.child_features.length) {
//       f.subfeatures = data.child_features
//         .map(childLocs => childLocs.map(childLoc => this.featureData(childLoc)))
//         .flat()
//     }

//     delete f.child_features
//     delete f.data
//     delete f.derived_features
//     delete f._linehash
//     delete f.attributes
//     delete f.seq_name
//     delete f.featureType
//     delete f.frame

//     if (f.transcript_id) {
//       f.name = f.transcript_id
//     }
//     return f
//   }

  public freeResources(/* { region } */) {}
}
