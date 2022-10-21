import { BamFile, HtsgetFile } from '@gmod/bam'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import BamAdapter from '../BamAdapter/BamAdapter'

export default class HtsgetBamAdapter extends BamAdapter {
  protected async configurePre() {
    const htsgetBase = readConfObject(this.config, 'htsgetBase')
    const htsgetTrackId = readConfObject(this.config, 'htsgetTrackId')
    const bam = new HtsgetFile({
      baseUrl: htsgetBase,
      trackId: htsgetTrackId,
    }) as unknown as BamFile

    const adapterConfig = readConfObject(this.config, 'sequenceAdapter')
    if (adapterConfig && this.getSubAdapter) {
      return this.getSubAdapter(adapterConfig).then(({ dataAdapter }) => {
        return {
          bam,
          sequenceAdapter: dataAdapter as BaseFeatureDataAdapter,
        }
      })
    }
    return { bam }
  }
}
