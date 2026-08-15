import { openLocation } from '@jbrowse/core/util/io'

import { McscanAnchorsAdapterBase } from '../McscanAnchorsAdapterBase.ts'
import { anchorScore } from '../mcscanUtil.ts'

import type { AnchorsSource } from '../McscanAnchorsAdapterBase.ts'
import type { MCScanAnchorsAdapterConfig } from './configSchema.ts'

export default class MCScanAnchorsAdapter extends McscanAnchorsAdapterBase<MCScanAnchorsAdapterConfig> {
  protected anchorsSource(): AnchorsSource {
    return {
      anchors: openLocation(
        this.getConf('mcscanAnchorsLocation'),
        this.pluginManager,
      ),
      // one orthologous gene pair per row, so the link's orientation is the
      // product of the two BED strands
      parseRow: ([name1, name2, score], join, rowNum) => {
        const pair = join(name1, name2)
        return pair === undefined
          ? undefined
          : {
              ...pair,
              rowNum,
              strand: pair.a.strand * pair.b.strand,
              score: anchorScore(score),
            }
      },
    }
  }
}
