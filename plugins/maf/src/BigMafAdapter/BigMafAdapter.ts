import { MafSubAdapterBase } from '../util/MafSubAdapterBase.ts'
import { MafStanzaReader } from '../util/mafStanzaReader.ts'
import { packedBlockText } from '../util/packedBlockText.ts'
import { makeSourceResolver } from '../util/parseAssemblyName.ts'

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

  protected async blockReader(_query: Region, opts?: BaseOptions) {
    return new MafStanzaReader(makeSourceResolver(await this.sampleIds(opts)))
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
