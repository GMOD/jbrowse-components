import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region, Feature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import IntervalTree from '@flatten-js/interval-tree'
import { unzip } from '@gmod/bgzf-filehandle'
import VCF from '@gmod/vcf'

// local
import VcfFeature from '../VcfFeature'

const readVcf = (f: string) => {
  const header: string[] = []
  const rest: string[] = []
  f.split(/\n|\r\n|\r/)
    .map(f => f.trim())
    .filter(f => !!f)
    .forEach(line => {
      if (line.startsWith('#')) {
        header.push(line)
      } else if (line) {
        rest.push(line)
      }
    })
  return { header: header.join('\n'), lines: rest }
}

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class VcfAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected vcfFeatures?: Promise<{
    header: string
    intervalTree: Record<string, IntervalTree>
  }>

  public async getHeader() {
    const { header } = await this.setup()
    return header
  }

  async getMetadata() {
    const { header } = await this.setup()
    const parser = new VCF({ header: header })
    return parser.getMetadata()
  }

  // converts lines into an interval tree
  public async setupP() {
    const pm = this.pluginManager
    const buf = await openLocation(this.getConf('vcfLocation'), pm).readFile()

    const buffer = isGzip(buf) ? await unzip(buf) : buf

    // 512MB  max chrome string length is 512MB
    if (buffer.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }

    const str = new TextDecoder().decode(buffer)
    const { header, lines } = readVcf(str)
    const intervalTree = {} as { [key: string]: IntervalTree }

    for (const obj of lines.map((line, id) => {
      const [refName, startP, , ref, , , , info] = line.split('\t')
      const start = +startP - 1
      const def = start + ref.length
      const end = +(info.match(/END=(\d+)/)?.[1].trim() || def)
      return { line, refName, start, end, id }
    })) {
      const key = obj.refName
      if (!intervalTree[key]) {
        intervalTree[key] = new IntervalTree()
      }
      intervalTree[key].insert([obj.start, obj.end], obj)
    }

    return { header, intervalTree }
  }

  public async setup() {
    if (!this.vcfFeatures) {
      this.vcfFeatures = this.setupP().catch(e => {
        this.vcfFeatures = undefined
        throw e
      })
    }
    return this.vcfFeatures
  }

  public async getRefNames(_: BaseOptions = {}) {
    const { intervalTree } = await this.setup()
    return Object.keys(intervalTree)
  }

  public getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = region
        const { header, intervalTree } = await this.setup()
        const parser = new VCF({ header })
        intervalTree[refName]?.search([start, end]).forEach(f =>
          observer.next(
            new VcfFeature({
              variant: parser.parseLine(f.line),
              parser,
              id: `${this.id}-${f.id}`,
            }),
          ),
        )
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

  public freeResources(): void {}
}
