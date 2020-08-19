import { HtsgetFile } from '@gmod/bam'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { getSubAdapterType } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BamAdapter from '../BamAdapter/BamAdapter'

interface HeaderLine {
  tag: string
  value: string
}
interface Header {
  idToName?: string[]
  nameToId?: Record<string, number>
}

export default class HtsgetAdapter extends BamAdapter {
  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
  ) {
    super(config, getSubAdapter)
    const htsgetBase = readConfObject(config, 'htsgetBase')
    const htsgetTrackId = readConfObject(config, 'htsgetTrackId')
    this.bam = new HtsgetFile({
      baseUrl: htsgetBase,
      trackId: htsgetTrackId,
    })
  }
}
