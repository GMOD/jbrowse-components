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
    intervalTree: Record<string, IntervalTree<VcfFeature> | undefined>
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
    const intervalTree = {} as Record<string, IntervalTree<VcfFeature>>

    const parser = new VCF({ header })
    let idx = 0
    for (const line of lines) {
      const f = new VcfFeature({
        variant: parser.parseLine(line),
        parser,
        id: `${this.id}-${idx++}`,
      })
      const key = f.get('refName')
      if (!intervalTree[key]) {
        intervalTree[key] = new IntervalTree<VcfFeature>()
      }
      intervalTree[key].insert([f.get('start'), f.get('end')], f)
    }

    return {
      header,
      intervalTree,
    }
  }

  public async setup() {
    if (!this.vcfFeatures) {
      this.vcfFeatures = this.setupP().catch((e: unknown) => {
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
        const { intervalTree } = await this.setup()
        intervalTree[refName]?.search([start, end]).forEach((f: VcfFeature) => {
          observer.next(f)
        })
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.signal)
  }

  public freeResources(): void {}
}
