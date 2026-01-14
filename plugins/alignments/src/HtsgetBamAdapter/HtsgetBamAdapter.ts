import { HtsgetFile } from '@gmod/bam'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import BamSlightlyLazyFeature from '../BamAdapter/BamSlightlyLazyFeature.ts'

import type { BamFile } from '@gmod/bam'

export default class HtsgetBamAdapter extends BamAdapter {
  protected configure() {
    if (!this.configureResult) {
      const htsgetBase = this.getConf('htsgetBase')
      const htsgetTrackId = this.getConf('htsgetTrackId')
      this.configureResult = {
        bam: new HtsgetFile({
          baseUrl: htsgetBase,
          trackId: htsgetTrackId,
          recordClass: BamSlightlyLazyFeature,
        }) as unknown as BamFile<BamSlightlyLazyFeature>,
      }
    }
    return this.configureResult
  }
}
