import { openLocation } from '@jbrowse/core/util/io'

import PAFAdapter from '../PAFAdapter/PAFAdapter.ts'
import { loadPafRecords } from '../PAFAdapter/util.ts'
import { paf_delta2paf } from './util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class DeltaAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    return loadPafRecords({
      file: openLocation(this.getConf('deltaLocation'), this.pluginManager),
      parse: paf_delta2paf,
      opts,
    })
  }
}
