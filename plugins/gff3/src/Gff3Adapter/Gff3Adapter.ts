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

const decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined

export default class Gff3Adapter extends BaseFeatureDataAdapter {
  calculatedIntervalTreeMap: Record<string, IntervalTree> = {}

  protected gffFeatures?: Promise<{
    header: string
    intervalTreeMap: Record<string, () => IntervalTree>
  }>

  private async loadDataP() {
    const pm = this.pluginManager
    const buf = await openLocation(this.getConf('gffLocation'), pm).readFile()
    const buffer = isGzip(buf) ? await unzip(buf) : buf
    const headerLines = []
    const featureMap = {} as Record<string, string[]>

    let blockStart = 0
    while (blockStart < buffer.length) {
      for (let i = 0; i < buffer.length; i++) {
        let tabOffset = -1
        let newlineOffset = -1
        if (buffer[i] === 9 && tabOffset !== -1) {
          tabOffset = i
        } else if (buffer[i] === 10) {
          newlineOffset = i
          const b = buffer.slice(blockStart, i)
          const line = (decoder?.decode(b) || b.toString()).trim()
          if (line.startsWith('#')) {
            if (line !== '###') {
              headerLines.push(line)
            }
          } else if (line && !line.startsWith('>')) {
            const l = line.length
            for (let i = 0; i < l; i++) {
              if (line[i] === '\t') {
                const refName = line.slice(0, i)
                if (!featureMap[refName]) {
                  featureMap[refName] = []
                }
                featureMap[refName].push(line)
                break
              }
            }
          }
        }
      }

      blockStart = n + 1
    }

    const intervalTreeMap = Object.fromEntries(
      Object.entries(featureMap).map(([refName, lines]) => {
        return [
          refName,
          () => {
            if (!this.calculatedIntervalTreeMap[refName]) {
              const intervalTree = new IntervalTree()
              gff
                .parseStringSync(lines.join('\n'), {
                  parseFeatures: true,
                  parseComments: false,
                  parseDirectives: false,
                  parseSequences: false,
                  disableDerivesFromReferences: true,
                })
                .flat()
                .map(
                  (f, i) =>
                    new SimpleFeature({
                      data: this.featureData(f),
                      id: `${this.id}-offset-${i}`,
                    }),
                )
                .forEach(obj =>
                  intervalTree.insert([obj.get('start'), obj.get('end')], obj),
                )
              this.calculatedIntervalTreeMap[refName] = intervalTree
            }
            return this.calculatedIntervalTreeMap[refName]
          },
        ]
      }),
    )

    return { header: headerLines.join('\n'), intervalTreeMap }
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

  public async getRefNames(_opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData()
    return Object.keys(intervalTreeMap)
  }

  public async getHeader() {
    const { header } = await this.loadData()
    return header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const { intervalTreeMap } = await this.loadData()
        intervalTreeMap[refName]()
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
    const defaultFields = new Set([
      'start',
      'end',
      'seq_id',
      'score',
      'type',
      'source',
      'phase',
      'strand',
    ])
    const dataAttributes = data.attributes || {}
    for (const a of Object.keys(dataAttributes)) {
      let b = a.toLowerCase()
      if (defaultFields.has(b)) {
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
    }
    f.refName = f.seq_id

    // the SimpleFeature constructor takes care of recursively inflating subfeatures
    if (data.child_features && data.child_features.length > 0) {
      f.subfeatures = data.child_features.flatMap(childLocs =>
        childLocs.map(childLoc => this.featureData(childLoc)),
      )
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
