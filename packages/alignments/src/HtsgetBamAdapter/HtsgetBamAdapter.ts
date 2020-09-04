import { HtsgetFile } from '@gmod/bam'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { getSubAdapterType } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import BamAdapter from '../BamAdapter/BamAdapter'

export default class HtsgetBamAdapter extends BamAdapter {
  configure(config: AnyConfigurationModel, getSubAdapter?: getSubAdapterType) {
    const htsgetBase = readConfObject(config, 'htsgetBase')
    const htsgetTrackId = readConfObject(config, 'htsgetTrackId')
    this.bam = new HtsgetFile({
      baseUrl: htsgetBase,
      trackId: htsgetTrackId,
    })

    const adapterConfig = readConfObject(config, 'sequenceAdapter')
    if (adapterConfig && getSubAdapter) {
      const { dataAdapter } = getSubAdapter(adapterConfig)
      this.sequenceAdapter = dataAdapter as BaseFeatureDataAdapter
    }
  }
}
