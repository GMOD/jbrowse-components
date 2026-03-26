import { openLocation } from '@jbrowse/core/util/io'

import { getSegmentsForOrdinalsFromShard } from './gfaBinaryIO.ts'
import { BaseGfaTabixAdapter } from './gfaTabixUtils.ts'

import type { IndexedBinaryShard } from './gfaBinaryIO.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { FileLocation } from '@jbrowse/core/util/types'

export default class GfaTabixAdapter extends BaseGfaTabixAdapter {
  private shard: IndexedBinaryShard

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pm = this.pluginManager

    const segmentsLoc = this.getConf('segmentsLocation') as FileLocation
    const segmentsIdxLoc = this.getConf('segmentsIdxLocation') as FileLocation

    this.shard = {
      filehandle: openLocation(segmentsLoc, pm),
      idxFile: openLocation(segmentsIdxLoc, pm),
    }
  }

  protected async getSegsForOrdinals(ordinalRanges: [number, number][]) {
    return getSegmentsForOrdinalsFromShard(this.shard, ordinalRanges)
  }
}
