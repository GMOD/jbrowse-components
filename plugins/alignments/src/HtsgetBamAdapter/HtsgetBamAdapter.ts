import { BamFile, HtsgetFile } from '@gmod/bam'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import BamAdapter from '../BamAdapter/BamAdapter'

export default class HtsgetBamAdapter extends BamAdapter {
  protected async configure() {
    if (!this.configured) {
      const htsgetBase = this.getConf('htsgetBase')
      const htsgetTrackId = this.getConf('htsgetTrackId')
      const bam = new HtsgetFile({
        baseUrl: htsgetBase,
        trackId: htsgetTrackId,
      }) as unknown as BamFile

      const adapterConfig = this.getConf('sequenceAdapter')
      if (adapterConfig && this.getSubAdapter) {
        this.configured = this.getSubAdapter(adapterConfig).then(
          ({ dataAdapter }) => ({
            bam,
            sequenceAdapter: dataAdapter as BaseFeatureDataAdapter,
          }),
        )
      }
      this.configured = Promise.resolve({ bam })
    }
    return this.configured
  }
}
