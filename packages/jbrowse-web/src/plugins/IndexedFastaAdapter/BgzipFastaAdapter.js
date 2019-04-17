import { BgzipIndexedFasta } from '@gmod/indexedfasta'

import { openLocation } from '@gmod/jbrowse-core/util/io'
import IndexedFasta from './IndexedFastaAdapter'

export default class BgzipFastaAdapter extends IndexedFasta {
  constructor(config, rootConfig) {
    super(config, rootConfig)
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
