import { Instance } from 'mobx-state-tree'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'

import gff from '@gmod/gff'
import { Observer } from 'rxjs'
import { GenericFilehandle } from 'generic-filehandle'

import MyConfigSchema from './configSchema'

type Strand = '+' | '-' | '.' | '?'
interface FeatureLoc {
  [key: string]: unknown
  start: number
  end: number
  strand: Strand
  seq_id: string
  child_features: FeatureLoc[][]
  data: unknown
  derived_features: unknown
  attributes: { [key: string]: unknown[] }
}

export default class extends BaseFeatureDataAdapter {
  protected gff: string | undefined

  protected features: FeatureLoc[][] | undefined

  protected dontRedispatch: string[]

  protected filehandle: GenericFilehandle

  public constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const gffLocation = readConfObject(config, 'gffLocation')
    const dontRedispatch = readConfObject(config, 'dontRedispatch')
    this.dontRedispatch = dontRedispatch || ['chromosome', 'contig', 'region']
    this.filehandle = openLocation(gffLocation, this.pluginManager)
  }

  private async loadData() {
    if (!this.gff) {
      this.gff = (await this.filehandle.readFile('utf8')) as string
      this.features = gff.parseStringSync(this.gff, {
        parseFeatures: true,
        parseComments: false,
        parseDirectives: false,
        parseSequences: false,
      }) as FeatureLoc[][]
    }
  }
  public async getRefNames(opts: BaseOptions = {}) {
    // return this.gff.getReferenceSequenceNames(opts)
    return [] // TODO: fix getRefNames
  }

  public async getHeader() {
    // return this.gff.getHeader()
    return '' // TODO: fix get header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      this.getFeaturesHelper(query, opts, observer, true)
    }, opts.signal)
  }

  private async getFeaturesHelper(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
    observer: Observer<Feature>,
    allowRedispatch: boolean,
    originalQuery = query,
  ) {
    await this.loadData()
    try {
      const validFeatures: FeatureLoc[][] = []
      // TODO: fix get features that match the query


      // if (allowRedispatch && lines.length) {
      //   let minStart = Infinity
      //   let maxEnd = -Infinity
      //   lines.forEach(line => {
      //     const featureType = line.fields[2]
      //     // only expand redispatch range if feature is not a "dontRedispatch" type
      //     // skips large regions like chromosome,region
      //     if (!this.dontRedispatch.includes(featureType)) {
      //       const start = line.start - 1 // gff is 1-based
      //       if (start < minStart) {
      //         minStart = start
      //       }
      //       if (line.end > maxEnd) {
      //         maxEnd = line.end
      //       }
      //     }
      //   })
      //   if (maxEnd > query.end || minStart < query.start) {
      //     this.getFeaturesHelper(
      //       { ...query, start: minStart, end: maxEnd },
      //       opts,
      //       observer,
      //       false,
      //       query,
      //     )
      //     return
      //   }
      // }
      // TODO: format features
      validFeatures.forEach(featureLocs =>
        this.formatFeatures(featureLocs).forEach(f => {
          if (
            doesIntersect2(
              f.get('start'),
              f.get('end'),
              originalQuery.start,
              originalQuery.end,
            )
          ) {
            observer.next(f)
          }
        }),
      )
      observer.complete()
    } catch (e) {
      observer.error(e)
    }
  }
  private formatFeatures(featureLocs: FeatureLoc[]) {
    return featureLocs.map(
      (featureLoc, index) =>
        new SimpleFeature({
          data: this.featureData(featureLoc),
          id: `${this.id}-offset-${index}`,
        }),
    )
  }

  private featureData(data: FeatureLoc) {
    const f: Record<string, unknown> = { ...data }
    ;(f.start as number) -= 1 // convert to interbase
    f.strand = { '+': 1, '-': -1, '.': 0, '?': undefined }[data.strand] // convert strand
    f.phase = Number(data.phase)
    f.refName = data.seq_id
    if (data.score === null) {
      delete f.score
    }
    if (data.phase === null) {
      delete f.score
    }
    const defaultFields = [
      'start',
      'end',
      'seq_id',
      'score',
      'type',
      'source',
      'phase',
      'strand',
    ]
    Object.keys(data.attributes).forEach(a => {
      let b = a.toLowerCase()
      if (defaultFields.includes(b)) {
        // add "suffix" to tag name if it already exists
        // reproduces behavior of NCList
        b += '2'
      }
      if (data.attributes[a] !== null) {
        let attr = data.attributes[a]
        if (Array.isArray(attr) && attr.length === 1) {
          ;[attr] = attr
        }
        f[b] = attr
      }
    })
    f.refName = f.seq_id

    // the SimpleFeature constructor takes care of recursively inflating subfeatures
    if (data.child_features && data.child_features.length) {
      f.subfeatures = data.child_features
        .map(childLocs => childLocs.map(childLoc => this.featureData(childLoc)))
        .flat()
    }

    delete f.child_features
    delete f.data
    delete f.derived_features
    delete f.attributes
    delete f.seq_id
    return f
  }

  public freeResources(/* { region } */) {}
}
