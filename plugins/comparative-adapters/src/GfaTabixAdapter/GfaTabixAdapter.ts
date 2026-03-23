import { BgzfFilehandle } from '@gmod/bgzf-filehandle'
import { openLocation } from '@jbrowse/core/util/io'

import {
  BaseGfaTabixAdapter,
  getSegmentsForOrdinalsFromShard,
} from './gfaTabixUtils.ts'

import type { SegRecord, SegmentsShard } from './gfaTabixUtils.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { FileLocation } from '@jbrowse/core/util/types'

export default class GfaTabixAdapter extends BaseGfaTabixAdapter {
  private shard: SegmentsShard

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pm = this.pluginManager

    const segmentsLoc = this.getConf('segmentsLocation') as FileLocation
    const segmentsGziLoc = this.getConf('segmentsGziLocation') as FileLocation
    const segmentsIdxLoc = this.getConf('segmentsIdxLocation') as FileLocation

    this.shard = {
      bgzf: new BgzfFilehandle({
        filehandle: openLocation(segmentsLoc, pm),
        gziFilehandle: openLocation(segmentsGziLoc, pm),
      }),
      idxFile: openLocation(segmentsIdxLoc, pm),
    }
  }

  protected async getSegsForOrdinals(
    ordinals: number[],
    pathNames: string[],
  ): Promise<SegRecord[]> {
    this.shard.pathNames ??= pathNames
    return getSegmentsForOrdinalsFromShard(this.shard, ordinals)
  }
}
