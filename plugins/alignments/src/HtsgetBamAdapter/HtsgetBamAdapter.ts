import { HtsgetFile } from '@gmod/bam'

import BamAdapter from '../BamAdapter/BamAdapter'

import type { BamFile } from '@gmod/bam'

export default class HtsgetBamAdapter extends BamAdapter {
  protected async configurePre() {
    const htsgetBase = this.getConf('htsgetBase')
    const htsgetTrackId = this.getConf('htsgetTrackId')
    const bam = new HtsgetFile({
      baseUrl: htsgetBase,
      trackId: htsgetTrackId,
    }) as unknown as BamFile
    return { bam }
  }
}
