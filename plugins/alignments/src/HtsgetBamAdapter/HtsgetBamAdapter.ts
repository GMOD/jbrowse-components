import { HtsgetFile } from '@gmod/bam'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import BamAdapter from '../BamAdapter/BamAdapter'

export default class HtsgetBamAdapter extends BamAdapter {
  protected async configure() {
    const htsgetBase = readConfObject(this.config, 'htsgetBase')
    const htsgetTrackId = readConfObject(this.config, 'htsgetTrackId')
    this.bam = new HtsgetFile({
      baseUrl: htsgetBase,
      trackId: htsgetTrackId,
    })

    const adapterConfig = readConfObject(this.config, 'sequenceAdapter')
    if (adapterConfig && this.getSubAdapter) {
      const { dataAdapter } = await this.getSubAdapter(adapterConfig)
      this.sequenceAdapter = dataAdapter as BaseFeatureDataAdapter
    }
  }
}
