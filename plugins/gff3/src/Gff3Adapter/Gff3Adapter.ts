import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import IntervalTree from '@flatten-js/interval-tree'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { unzip } from '@gmod/bgzf-filehandle'

import gff, { GFF3FeatureLineWithRefs } from '@gmod/gff'

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class extends BaseFeatureDataAdapter {
  protected gffFeatures?: Promise<{
    header: string
    intervalTree: Record<string, IntervalTree>
  }>

  private async loadDataP() {
    const pm = this.pluginManager
    const buf = await openLocation(this.getConf('gffLocation'), pm).readFile()
    const buffer = isGzip(buf) ? await unzip(buf) : buf
    // 512MB  max chrome string length is 512MB
    if (buffer.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const data = new TextDecoder('utf8', { fatal: true }).decode(buffer)
    const lines = data.split(/\n|\r\n|\r/)
    const headerLines = []
    for (let i = 0; i < lines.length && lines[i].startsWith('#'); i++) {
      headerLines.push(lines[i])
    }
    const header = headerLines.join('\n')

    const feats = gff.parseStringSync(data, {
      parseFeatures: true,
      parseComments: false,
      parseDirectives: false,
      parseSequences: false,
      disableDerivesFromReferences: true,
    })

    const intervalTree = feats
      .flat()
      .map(
        (f, i) =>
          new SimpleFeature({
            data: this.featureData(f),
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
      }, {} as Record<string, IntervalTree>)

    return { header, intervalTree }
  }

  private async loadData() {
    if (!this.gffFeatures) {
      this.gffFeatures = this.loadDataP().catch(e => {
        this.gffFeatures = undefined
        throw e
      })
    }

    return this.gffFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTree } = await this.loadData()
    return Object.keys(intervalTree)
  }

  public async getHeader() {
    const { header } = await this.loadData()
    return header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const { intervalTree } = await this.loadData()
        intervalTree[refName]
          ?.search([start, end])
          .forEach(f => observer.next(f))
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

  private featureData(data: GFF3FeatureLineWithRefs) {
    const f: Record<string, unknown> = { ...data }
    ;(f.start as number) -= 1 // convert to interbase
    if (data.strand === '+') {
      f.strand = 1
    } else if (data.strand === '-') {
      f.strand = -1
    } else if (data.strand === '.') {
      f.strand = 0
    } else {
      f.strand = undefined
    }
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
    const dataAttributes = data.attributes || {}
    Object.keys(dataAttributes).forEach(a => {
      let b = a.toLowerCase()
      if (defaultFields.includes(b)) {
        // add "suffix" to tag name if it already exists
        // reproduces behavior of NCList
        b += '2'
      }
      if (dataAttributes[a] !== null) {
        let attr: string | string[] | undefined = dataAttributes[a]
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
    // delete f.derived_features
    delete f.attributes
    delete f.seq_id
    return f
  }

  public freeResources(/* { region } */) {}
}
