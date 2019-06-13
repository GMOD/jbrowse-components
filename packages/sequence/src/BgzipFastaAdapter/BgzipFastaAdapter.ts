import { BgzipIndexedFasta } from '@gmod/indexedfasta'
import { IFileLocation } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import IndexedFasta from '../IndexedFastaAdapter/IndexedFastaAdapter'

export default class extends IndexedFasta {
  public constructor(config: {
    fastaLocation: IFileLocation
    faiLocation: IFileLocation
    gziLocation: IFileLocation
  }) {
    super(config)
    const { fastaLocation, faiLocation, gziLocation } = config
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
      fasta: openLocation(fastaLocation),
      fai: openLocation(faiLocation),
      gzi: openLocation(gziLocation),
    }

    this.fasta = new BgzipIndexedFasta(fastaOpts)
  }
}
