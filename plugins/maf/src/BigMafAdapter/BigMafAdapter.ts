import { MafSubAdapterBase } from '../util/MafSubAdapterBase.ts'
import { packedBlockText } from '../util/packedBlockText.ts'

import type { BigMafAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BigMafAdapter extends MafSubAdapterBase<BigMafAdapterConfig> {
  protected subAdapterConfig() {
    return {
      type: 'BigBedAdapter',
      bigBedLocation: this.getConf('bigBedLocation'),
    }
  }

  protected blockReader(_query: Region, opts?: BaseOptions) {
    return this.stanzaReader(opts)
  }

  protected blockText(feature: Feature) {
    return packedBlockText(feature, {
      adapterName: 'BigMafAdapter',
      field: 'mafBlock',
      noun: 'mafBlock field',
      expected:
        'Expected a bigMaf built by `mafToBigMaf` + `bedToBigBed -as=bigMaf.as` — ' +
        'check that bigBedLocation is the alignment file and not a bigMafSummary.bb.',
    })
  }
}
