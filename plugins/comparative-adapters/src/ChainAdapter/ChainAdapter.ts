import { openLocation } from '@jbrowse/core/util/io'

import { PafRecordsAdapter } from '../PAFAdapter/PAFAdapter.ts'
import { loadPafRecords } from '../PAFAdapter/util.ts'
import { paf_chain2paf } from './util.ts'

import type { ChainAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class ChainAdapter extends PafRecordsAdapter<ChainAdapterConfig> {
  async setupPre(opts?: BaseOptions) {
    return loadPafRecords({
      file: openLocation(this.getConf('chainLocation'), this.pluginManager),
      parse: paf_chain2paf,
      opts,
    })
  }
}
