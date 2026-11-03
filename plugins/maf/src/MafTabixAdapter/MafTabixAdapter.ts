import { MafSubAdapterBase } from '../util/MafSubAdapterBase.ts'
import { packedBlockText } from '../util/packedBlockText.ts'
import { MafTabixBlockReader } from './tabixBlockReader.ts'

import type { MafTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class MafTabixAdapter extends MafSubAdapterBase<MafTabixAdapterConfig> {
  protected subAdapterConfig() {
    return {
      type: 'BedTabixAdapter',
      bedGzLocation: this.getConf('bedGzLocation'),
      index: {
        location: this.getConf(['index', 'location']),
        indexType: this.getConf(['index', 'indexType']),
      },
    }
  }

  protected async blockReader(query: Region, opts?: BaseOptions) {
    return new MafTabixBlockReader(
      await this.sampleIds(opts),
      this.getConf('refAssemblyName'),
      query.assemblyName,
    )
  }

  protected blockText(feature: Feature) {
    return packedBlockText(feature, {
      adapterName: 'MafTabixAdapter',
      // column 6, which @gmod/bed names field5 only on a headerless file
      field: 'field5',
      noun: 'alignment column',
      expected:
        'Expected column 6 of a headerless BED, holding every species as ' +
        '`sample.chr:start:size:strand:srcSize:seq` — check that bedGzLocation is ' +
        'the alignment BED and not the `--summary` one.',
    })
  }
}
