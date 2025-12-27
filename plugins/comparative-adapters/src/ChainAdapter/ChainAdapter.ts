import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { paf_chain2paf } from './util'
import PAFAdapter from '../PAFAdapter/PAFAdapter'
import { getWeightedMeans } from '../PAFAdapter/util'

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
