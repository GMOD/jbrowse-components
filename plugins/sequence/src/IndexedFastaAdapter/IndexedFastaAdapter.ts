import { IndexedFasta } from '@gmod/indexedfasta'
import { openLocation } from '@jbrowse/core/util/io'

import { FastaAdapterBase } from '../FastaAdapterBase.ts'

import type { IndexedFastaAdapterConfig } from './configSchema.ts'

export default class IndexedFastaAdapter extends FastaAdapterBase<IndexedFastaAdapterConfig> {
  public async setupPre() {
    return {
      fasta: new IndexedFasta({
        fasta: openLocation(this.getConf('fastaLocation'), this.pluginManager),
        fai: openLocation(this.getConf('faiLocation'), this.pluginManager),
      }),
    }
  }
}
