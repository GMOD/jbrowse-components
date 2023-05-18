import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Region, Feature, SimpleFeature } from '@jbrowse/core/util'
import IntervalTree from '@flatten-js/interval-tree'
import { unzip } from '@gmod/bgzf-filehandle'

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export function featureData(
  line: string,
  uniqueId: string,
  flip: boolean,
  names?: string[],
) {
  const l = line.split('\t')
  const ref1 = l[flip ? 3 : 0]
  const start1 = +l[flip ? 4 : 1]
  const end1 = +l[flip ? 5 : 2]
  const ref2 = +l[!flip ? 3 : 0]
  const start2 = +l[!flip ? 4 : 1]
  const end2 = +l[!flip ? 5 : 2]
  const name = l[6]
  const score = +l[7]
  const strand1 = parseStrand(l[8])
  const strand2 = parseStrand(l[9])
  const extra = l.slice(9)
  const rest = names
    ? Object.fromEntries(names.slice(9).map((n, idx) => [n, extra[idx]]))
    : extra

  return new SimpleFeature({
    start: start1,
    end: end1,
    refName: ref1,
    strand: strand1,
    name,
    ...rest,
    score,
    uniqueId,
    mate: { refName: ref2, start: start2, end: end2, strand: strand2 },
  })
}

function parseStrand(strand: string) {
  if (strand === '+') {
    return 1
  } else if (strand === '-') {
    return -1
  } else if (strand === '.') {
    return 0
  } else {
    return undefined
  }
}

export default class BedpeAdapter extends BaseFeatureDataAdapter {
  protected bedpeFeatures?: Promise<{
    header: string
    feats1: Record<string, string[] | undefined>
    feats2: Record<string, string[] | undefined>
    columnNames: string[]
  }>

  protected intervalTrees: {
    [key: string]: Promise<IntervalTree | undefined> | undefined
  } = {}

  public static capabilities = ['getFeatures', 'getRefNames']

  private async loadDataP(opts: BaseOptions = {}) {
    const pm = this.pluginManager
    const bedLoc = this.getConf('bedpeLocation')
    const buf = await openLocation(bedLoc, pm).readFile(opts)
    const buffer = isGzip(buf) ? await unzip(buf) : buf
    // 512MB  max chrome string length is 512MB
    if (buffer.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const data = new TextDecoder('utf8', { fatal: true }).decode(buffer)
    const lines = data.split(/\n|\r\n|\r/).filter(f => !!f)
    const headerLines = []
    let i = 0
    for (; i < lines.length && lines[i].startsWith('#'); i++) {
      headerLines.push(lines[i])
    }
    const header = headerLines.join('\n')
    const feats1 = {} as Record<string, string[] | undefined>
    const feats2 = {} as Record<string, string[] | undefined>
    for (; i < lines.length; i++) {
      const line = lines[i]
      const cols = line.split('\t')
      const r1 = cols[0]
      const r2 = cols[3]
      if (!feats1[r1]) {
        feats1[r1] = []
      }
      if (!feats2[r2]) {
        feats2[r2] = []
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      feats1[r1]!.push(line)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      feats2[r2]!.push(line)
    }
    const columnNames = this.getConf('columnNames')

    return {
      header,
      feats1,
      feats2,
      columnNames,
    }
  }

  private async loadData(opts: BaseOptions = {}) {
    if (!this.bedpeFeatures) {
      this.bedpeFeatures = this.loadDataP(opts).catch(e => {
        this.bedpeFeatures = undefined
        throw e
      })
    }

    return this.bedpeFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { feats1, feats2 } = await this.loadData(opts)
    return [...new Set([...Object.keys(feats1), ...Object.keys(feats2)])]
  }

  async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  async getNames() {
    const { header, columnNames } = await this.loadData()
    if (columnNames.length) {
      return columnNames
    }
    const defs = header.split(/\n|\r\n|\r/).filter(f => !!f)
    const defline = defs[defs.length - 1]
    return defline?.includes('\t')
      ? defline
          .slice(1)
          .split('\t')
          .map(field => field.trim())
      : undefined
  }

  private async loadFeatureTreeP(refName: string) {
    const { feats1, feats2 } = await this.loadData()
    const lines1 = feats1[refName]
    const lines2 = feats2[refName]
    const names = await this.getNames()

    const intervalTree = new IntervalTree()
    const ret1 = lines1?.map((f, i) => {
      const uniqueId = `${this.id}-${refName}-${i}`
      return featureData(f, uniqueId, false, names)
    })
    const ret2 = lines2?.map((f, i) => {
      const uniqueId = `${this.id}-${refName}-${i}`
      return featureData(f, uniqueId, true, names)
    })

    if (ret1) {
      for (const obj of ret1) {
        intervalTree.insert([obj.get('start'), obj.get('end')], obj)
      }
    }

    if (ret2) {
      for (const obj of ret2) {
        intervalTree.insert([obj.get('start'), obj.get('end')], obj)
      }
    }

    return intervalTree
  }

  private async loadFeatureTree(refName: string) {
    if (!this.intervalTrees[refName]) {
      this.intervalTrees[refName] = this.loadFeatureTreeP(refName).catch(e => {
        this.intervalTrees[refName] = undefined
        throw e
      })
    }
    return this.intervalTrees[refName]
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const intervalTree = await this.loadFeatureTree(refName)
      intervalTree?.search([start, end]).forEach(f => observer.next(f))
      observer.complete()
    }, opts.signal)
  }

  public freeResources(): void {}
}
