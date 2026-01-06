import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { paf_delta2paf } from './util.ts'
import PAFAdapter from '../PAFAdapter/PAFAdapter.ts'
import { getWeightedMeans } from '../PAFAdapter/util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class DeltaAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    return getWeightedMeans(
      paf_delta2paf(
        await fetchAndMaybeUnzip(
          openLocation(this.getConf('deltaLocation'), this.pluginManager),
          opts,
        ),
        opts,
      ),
    )
  }
}
