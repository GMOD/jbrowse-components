import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { paf_chain2paf } from './util.ts'
import PAFAdapter from '../PAFAdapter/PAFAdapter.ts'
import { getWeightedMeans } from '../PAFAdapter/util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class ChainAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    return getWeightedMeans(
      paf_chain2paf(
        await fetchAndMaybeUnzip(
          openLocation(this.getConf('chainLocation'), this.pluginManager),
          opts,
        ),
        opts,
      ),
    )
  }
}
