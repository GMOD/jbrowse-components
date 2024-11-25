import { HtsgetFile } from '@gmod/bam'
import BamAdapter from '../BamAdapter/BamAdapter'
import type { BamFile } from '@gmod/bam'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class HtsgetBamAdapter extends BamAdapter {
  protected async configurePre() {
    const htsgetBase = this.getConf('htsgetBase')
    const htsgetTrackId = this.getConf('htsgetTrackId')
    const bam = new HtsgetFile({
      baseUrl: htsgetBase,
      trackId: htsgetTrackId,
    }) as unknown as BamFile

    const adapterConfig = this.getConf('sequenceAdapter')
    if (adapterConfig && this.getSubAdapter) {
      const adapter = await this.getSubAdapter(adapterConfig)
      return {
        bam,
        sequenceAdapter: adapter.dataAdapter as BaseFeatureDataAdapter,
      }
    }
    return { bam }
  }
}
