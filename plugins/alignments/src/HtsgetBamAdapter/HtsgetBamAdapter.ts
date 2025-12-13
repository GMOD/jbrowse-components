import { HtsgetFile } from '@gmod/bam'

import BamAdapter from '../BamAdapter/BamAdapter'

import type BamSlightlyLazyFeature from '../BamAdapter/BamSlightlyLazyFeature'

export default class HtsgetBamAdapter extends BamAdapter {
  protected configure() {
    if (!this.configureResult) {
      const htsgetBase = this.getConf('htsgetBase')
      const htsgetTrackId = this.getConf('htsgetTrackId')
      this.configureResult = {
        bam: new HtsgetFile<BamSlightlyLazyFeature>({
          baseUrl: htsgetBase,
          trackId: htsgetTrackId,
        }),
      }
    }
    return this.configureResult
  }
}
