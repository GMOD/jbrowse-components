import { BgzipIndexedFasta } from '@gmod/indexedfasta'
import { openLocation } from '@jbrowse/core/util/io'

import { FastaAdapterBase } from '../FastaAdapterBase.ts'

import type { BgzipFastaAdapterConfig } from './configSchema.ts'

export default class BgzipFastaAdapter extends FastaAdapterBase<BgzipFastaAdapterConfig> {
  public async setupPre() {
    return {
      fasta: new BgzipIndexedFasta({
        fasta: openLocation(this.getConf('fastaLocation'), this.pluginManager),
        fai: openLocation(this.getConf('faiLocation'), this.pluginManager),
        gzi: openLocation(this.getConf('gziLocation'), this.pluginManager),
      }),
    }
  }
}
