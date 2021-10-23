import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { FileLocation, Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import IntervalTree from '@flatten-js/interval-tree'
import VcfFeature from '../VcfTabixAdapter/VcfFeature'
import VCF from '@gmod/vcf'
import { unzip } from '@gmod/bgzf-filehandle'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

const readVcf = (f: string) => {
  const lines = f.split('\n')
  const header: string[] = []
  const refNames: string[] = []
  const rest: string[] = []
  lines.forEach(line => {
    if (line.startsWith('##contig')) {
      refNames.push(line.split('##contig=<ID=')[1].split(',')[0])
    } else if (line.startsWith('#')) {
      header.push(line)
    } else if (line) {
      rest.push(line)
    }
  })
  return { header: header.join('\n'), lines: rest, refNames }
}

export default class VcfAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected vcfFeatures?: Promise<Record<string, IntervalTree>>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
  }

  private async decodeFileContents() {
    const vcfLocation = readConfObject(
      this.config,
      'vcfLocation',
    ) as FileLocation

    let fileContents = await openLocation(
      vcfLocation,
      this.pluginManager,
    ).readFile()

    if (
      typeof fileContents[0] === 'number' &&
      fileContents[0] === 31 &&
      typeof fileContents[1] === 'number' &&
      fileContents[1] === 139 &&
      typeof fileContents[2] === 'number' &&
      fileContents[2] === 8
    ) {
      fileContents = new TextDecoder().decode(await unzip(fileContents))
    } else {
      fileContents = fileContents.toString()
    }

    return readVcf(fileContents)
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
    const { header, lines } = await this.decodeFileContents()

    const parser = new VCF({ header: header })

    return lines.map((line, index) => {
      return new VcfFeature({
        variant: parser.parseLine(line),
        parser,
        id: `${this.id}-vcf-${index}`,
      })
    })
  }

  public async setup() {
    if (!this.vcfFeatures) {
      this.vcfFeatures = this.getLines().then(feats => {
        return feats.reduce(
          (acc: Record<string, IntervalTree>, obj: VcfFeature) => {
            const key = obj.get('refName')
            if (!acc[key]) {
              acc[key] = new IntervalTree()
            }
            acc[key].insert([obj.get('start'), obj.get('end')], obj)
            return acc
          },
          {},
        )
      })
    }
    return this.vcfFeatures
  }

  public async getRefNames(_: BaseOptions = {}) {
    const { refNames } = await this.decodeFileContents()
    if (refNames.length === 0) {
      return [
        'chr1',
        'chr2',
        'chr3',
        'chr4',
        'chr5',
        'chr6',
        'chr7',
        'chr8',
        'chr9',
        'chr10',
        'chr11',
        'chr12',
        'chr13',
        'chr14',
        'chr15',
        'chr16',
        'chr17',
        'chr18',
        'chr19',
        'chr20',
        'chr21',
        'chr22',
        'chr23',
        'chrX',
        'chrY',
        'chrMT',
      ]
    }
    return refNames
  }

  public getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = region
        const vcfFeatures = await this.setup()
        const tree = vcfFeatures[refName]
        const feats = tree.search([start, end]) //  expected array ['val1']
        feats.forEach(f => {
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
