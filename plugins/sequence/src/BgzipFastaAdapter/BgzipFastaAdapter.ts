import { BgzipIndexedFasta } from '@gmod/indexedfasta'
import { FileLocation } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import IndexedFasta from '../IndexedFastaAdapter/IndexedFastaAdapter'

export default class extends IndexedFasta {
  public constructor(config: AnyConfigurationModel) {
    super(config)
    const fastaLocation = readConfObject(config, 'fastaLocation')
    const faiLocation = readConfObject(config, 'faiLocation')
    const gziLocation = readConfObject(config, 'gziLocation')
    if (!fastaLocation) {
      throw new Error('must provide fastaLocation')
    }
    if (!faiLocation) {
      throw new Error('must provide faiLocation')
    }
    if (!gziLocation) {
      throw new Error('must provide gziLocation')
    }
    const fastaOpts = {
      fasta: openLocation(fastaLocation as FileLocation),
      fai: openLocation(faiLocation as FileLocation),
      gzi: openLocation(gziLocation as FileLocation),
    }

    this.fasta = new BgzipIndexedFasta(fastaOpts)
  }
}
