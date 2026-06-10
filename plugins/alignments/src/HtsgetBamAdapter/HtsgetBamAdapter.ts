import { HtsgetFile } from '@gmod/bam'
import { readConfObject } from '@jbrowse/core/configuration'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import BamSlightlyLazyFeature from '../BamAdapter/BamSlightlyLazyFeature.ts'

import type { HtsgetBamAdapterConfig } from './configSchema.ts'

export default class HtsgetBamAdapter extends BamAdapter {
  protected configure() {
    if (!this.configureResult) {
      // this.config is BamAdapterConfig at the type level (from the parent),
      // but at runtime it is always HtsgetBamAdapterConfig for this class
      const conf = this.config as unknown as HtsgetBamAdapterConfig
      const htsgetBase = readConfObject(conf, 'htsgetBase')
      const htsgetTrackId = readConfObject(conf, 'htsgetTrackId')
      this.configureResult = {
        bam: new HtsgetFile<BamSlightlyLazyFeature>({
          baseUrl: htsgetBase,
          trackId: htsgetTrackId,
          recordClass: BamSlightlyLazyFeature,
        }),
      }
    }
    return this.configureResult
  }
}
