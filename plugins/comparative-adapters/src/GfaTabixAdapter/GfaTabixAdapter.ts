import { BgzfFilehandle } from '@gmod/bgzf-filehandle'
import { openLocation } from '@jbrowse/core/util/io'

import {
  BaseGfaTabixAdapter,
  getSegsForRangeFromShard,
} from './gfaTabixUtils.ts'

import type { SegRecord, SegsShard } from './gfaTabixUtils.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { FileLocation } from '@jbrowse/core/util/types'

export default class GfaTabixAdapter extends BaseGfaTabixAdapter {
  private shard: SegsShard

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pm = this.pluginManager

    const segsLoc = this.getConf('segmentsLocation') as FileLocation
    const segsGziLoc = this.getConf('segmentsGziLocation') as FileLocation
    const segsIdxLoc = this.getConf('segmentsIdxLocation') as FileLocation

    this.shard = {
      bgzf: new BgzfFilehandle({
        filehandle: openLocation(segsLoc, pm),
        gziFilehandle: openLocation(segsGziLoc, pm),
      }),
      idxFile: openLocation(segsIdxLoc, pm),
    }
  }

  protected async getSegsForRange(
    minSegOrd: number,
    maxSegOrd: number,
  ): Promise<SegRecord[]> {
    return getSegsForRangeFromShard(this.shard, minSegOrd, maxSegOrd)
  }
}
