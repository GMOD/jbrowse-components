import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import IntervalTree from '@flatten-js/interval-tree'
import { unzip } from '@gmod/bgzf-filehandle'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import VCF from '@gmod/vcf'
import VcfFeature from '../VcfTabixAdapter/VcfFeature'

const readVcf = (f: string) => {
  const lines = f.split('\n')
  const header: string[] = []
  const rest: string[] = []
  lines.forEach(line => {
    if (line.startsWith('#')) {
      header.push(line)
    } else if (line) {
      rest.push(line)
    }
  })
  return { header: header.join('\n'), lines: rest }
}

export default class VcfAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected vcfFeatures?: Promise<Record<string, IntervalTree>>
  protected unzipped?: Promise<{ header: string; lines: string[] }>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
  }

  private async decodeFileContents() {
    if (!this.unzipped) {
      this.unzipped = openLocation(
        readConfObject(this.config, 'vcfLocation'),
        this.pluginManager,
      )
        .readFile()
        .then(async fileContents => {
          // detect gzip
          return fileContents[0] === 31 &&
            fileContents[1] === 139 &&
            fileContents[2] === 8
            ? new TextDecoder().decode(await unzip(fileContents))
            : fileContents.toString()
        })
        .then(str => readVcf(str))
    }
    return this.unzipped
  }

  public async getHeader() {
    const { header } = await this.decodeFileContents()
    return header
  }

  async getMetadata() {
    const { header } = await this.decodeFileContents()
    const parser = new VCF({ header: header })
    return parser.getMetadata()
  }

  public async getLines() {
    const { lines } = await this.decodeFileContents()

    return lines.map((l, id) => {
      const [refName, s, _id, ref, _alt, _qual, _filt, info] = l.split('\t')
      const start = +s - 1
      const end = +(info.match(/END=(\d+)/)?.[1].trim() || start + ref.length)

      return {
        line,
        refName,
        start,
        end,
        id,
      }
    })
  }

  public async setup() {
    if (!this.vcfFeatures) {
      this.vcfFeatures = this.getLines().then(feats => {
        return feats.reduce(
          (
            acc: Record<string, IntervalTree>,
            obj: { refName: string; start: number; end: number; line: string },
          ) => {
            const key = obj.refName
            if (!acc[key]) {
              acc[key] = new IntervalTree()
            }
            acc[key].insert([obj.start, obj.end], obj)
            return acc
          },
          {},
        )
      })
    }
    return this.vcfFeatures
  }

  public async getRefNames(_: BaseOptions = {}) {
    const lines = await this.getLines()
    return [...new Set(lines.map(line => line.refName))]
  }

  public getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { header } = await this.decodeFileContents()
        const { start, end, refName } = region
        const parser = new VCF({ header: header })
        const vcfFeatures = await this.setup()
        vcfFeatures[refName]?.search([start, end]).forEach(f =>
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
