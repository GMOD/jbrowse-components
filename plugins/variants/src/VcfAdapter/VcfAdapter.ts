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
import VcfFeature from '../VcfTabixAdapter/VcfFeature'
import VCF from '@gmod/vcf'
import { unzip } from '@gmod/bgzf-filehandle'

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

  private setupP?: Promise<Feature[]>

  public constructor(config: AnyConfigurationModel) {
    super(config)
  }

  private async decodeFileContents() {
    const vcfLocation = readConfObject(
      this.config,
      'vcfLocation',
    ) as FileLocation

    let fileContents = await openLocation(vcfLocation).readFile()

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
    if (!this.setupP) {
      this.setupP = this.getLines()
    }
    return this.setupP
  }

  public async getRefNames(_: BaseOptions = {}) {
    const { refNames } = await this.decodeFileContents()
    return refNames
  }

  public getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const feats = await this.setup()
      feats.forEach(f => {
        if (
          f.get('refName') === region.refName &&
          f.get('end') > region.start &&
          f.get('start') < region.end
        ) {
          observer.next(f)
        }
      })
      observer.complete()
    }, opts.signal)
  }

  public freeResources(): void {}
}
