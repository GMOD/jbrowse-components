import { HtsgetFile } from '@gmod/bam'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import BamAdapter from '../BamAdapter/BamAdapter'

export default class HtsgetBamAdapter extends BamAdapter {
  protected async configure() {
    if (!this.configured) {
      const htsgetBase = readConfObject(this.config, 'htsgetBase')
      const htsgetTrackId = readConfObject(this.config, 'htsgetTrackId')
      const bam = new HtsgetFile({
        baseUrl: htsgetBase,
        trackId: htsgetTrackId,
      })

      const adapterConfig = readConfObject(this.config, 'sequenceAdapter')
      if (adapterConfig && this.getSubAdapter) {
        this.configured = this.getSubAdapter(adapterConfig).then(
          ({ dataAdapter }) => {
            return {
              bam,
              sequenceAdapter: dataAdapter as BaseFeatureDataAdapter,
            }
          },
        )
      }
      this.configured = Promise.resolve({ bam })
    }
    return this.configured
  }
}
