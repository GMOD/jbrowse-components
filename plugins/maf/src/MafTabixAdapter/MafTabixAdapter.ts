import { MafSubAdapterBase } from '../util/MafSubAdapterBase.ts'
import { MafTabixBlockReader } from './tabixBlockReader.ts'

import type { MafTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

/**
 * The packed per-species alignment column of a `maf2bed` / `maf_to_bed.py` BED:
 * the 6th, which `@gmod/bed` names `field5` on a **headerless** file.
 *
 * Guarded rather than cast because that name is not universal, and the way to
 * lose it is an easy mistake to make: `BedTabixAdapter` takes its column names
 * from a `#` header line when the file has one (or from an `autoSql` config),
 * and the summary BED this adapter's own `summaryAdapter` slot wants — the
 * sibling file `maf2bed --summary` writes in the same pass — has exactly such a
 * header. Swap the two paths and every feature reaches `.split` on `undefined`,
 * which surfaces as `Cannot read properties of undefined` with nothing in it
 * naming a MAF, a column, or a file.
 */
function alignmentColumn(feature: Feature) {
  const encoded = feature.get('field5')
  if (typeof encoded !== 'string') {
    throw new Error(
      `MafTabixAdapter: no alignment column at ${feature.get('refName')}:${feature.get('start')}. ` +
        'Expected column 6 of a headerless BED, holding every species as ' +
        '`sample.chr:start:size:strand:srcSize:seq` — check that bedGzLocation is ' +
        'the alignment BED and not the `--summary` one.',
    )
  }
  return encoded
}

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
    return alignmentColumn(feature)
  }
}
