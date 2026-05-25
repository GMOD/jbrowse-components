import { HtsgetFile } from '@gmod/bam'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import BamSlightlyLazyFeature from '../BamAdapter/BamSlightlyLazyFeature.ts'

export default class HtsgetBamAdapter extends BamAdapter {
  protected configure() {
    if (!this.configureResult) {
      const htsgetBase = this.getConf('htsgetBase')
      const htsgetTrackId = this.getConf('htsgetTrackId')
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
