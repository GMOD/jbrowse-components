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
      this.configureResult = {
        bam: new HtsgetFile<BamSlightlyLazyFeature>({
          baseUrl: readConfObject(conf, 'htsgetBase'),
          trackId: readConfObject(conf, 'htsgetTrackId'),
          recordClass: BamSlightlyLazyFeature,
        }),
      }
    }
    return this.configureResult
  }
}
