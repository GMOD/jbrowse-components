import { Instance } from 'mobx-state-tree'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import IntervalTree from '@flatten-js/interval-tree'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'

import gff from '@gmod/gff'
import { GenericFilehandle } from 'generic-filehandle'

import MyConfigSchema from './configSchema'
import { FeatureLoc } from '../util'

export default class extends BaseFeatureDataAdapter {
  protected gffFeatures?: Promise<Record<string, IntervalTree>>

  protected uri: string

  protected filehandle: GenericFilehandle

  public constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const gffLocation = readConfObject(config, 'gffLocation')
    const { uri } = gffLocation
    this.uri = uri
    this.filehandle = openLocation(gffLocation, this.pluginManager)
  }

  private async loadData() {
    const { size } = await this.filehandle.stat()
    // Add a warning to avoid crashing the browser, recommend indexing
    if (size > 500_000_000) {
      throw new Error('This file is too large. Consider using Gff3TabixAdapter')
    }
    if (!this.gffFeatures) {
      this.gffFeatures = this.filehandle
        .readFile('utf8')
        .then(data => {
          const gffFeatures = gff.parseStringSync(data, {
            parseFeatures: true,
            parseComments: false,
            parseDirectives: false,
            parseSequences: false,
          }) as FeatureLoc[][]

          return gffFeatures
            .flat()
            .map(
              (f, i) =>
                new SimpleFeature({
                  data: this.featureData(f),
                  id: `${this.id}-offset-${i}`,
                }),
            )
            .reduce((acc: Record<string, IntervalTree>, obj: SimpleFeature) => {
              const key = obj.get('refName')
              if (!acc[key]) {
                acc[key] = new IntervalTree()
              }
              acc[key].insert([obj.get('start'), obj.get('end')], obj)
              return acc
            }, {})
        })
        .catch(e => {
          this.gffFeatures = undefined
          throw e
        })
    }

    return this.gffFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const gffFeatures = await this.loadData()
    return Object.keys(gffFeatures)
  }
  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const gffFeatures = await this.loadData()
        const tree = gffFeatures[refName]
        const feats = tree.search([start, end])
        feats.forEach(f => {
          observer.next(f)
        })
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
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
