import { MafSubAdapterBase } from '../util/MafSubAdapterBase.ts'
import { BigMafBlockReader } from './stanzaBlockReader.ts'

import type { BigMafAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

/**
 * The `;`-joined MAF stanza bigMaf packs into its one extra bigBed field.
 *
 * Guarded rather than cast for the same reason as MAF-tabix's `field5`: the
 * name comes from the file's own autoSql, so a BigBed that isn't a bigMaf
 * doesn't have it — and the easiest way to get one here is to put the
 * `bigMafSummary.bb` that this adapter's `summaryAdapter` slot wants into
 * `bigBedLocation`, since both are `.bb` files built from the same alignment.
 * Cast, that reached `.split` on `undefined` for every feature.
 */
function mafBlockField(feature: Feature) {
  const block = feature.get('mafBlock')
  if (typeof block !== 'string') {
    throw new Error(
      `BigMafAdapter: no mafBlock field at ${feature.get('refName')}:${feature.get('start')}. ` +
        'Expected a bigMaf built by `mafToBigMaf` + `bedToBigBed -as=bigMaf.as` — ' +
        'check that bigBedLocation is the alignment file and not a bigMafSummary.bb.',
    )
  }
  return block
}

export default class BigMafAdapter extends MafSubAdapterBase<BigMafAdapterConfig> {
  protected subAdapterConfig() {
    return {
      type: 'BigBedAdapter',
      bigBedLocation: this.getConf('bigBedLocation'),
    }
  }

  protected async blockReader(_query: Region, opts?: BaseOptions) {
    return new BigMafBlockReader(await this.sampleIds(opts))
  }

  protected blockText(feature: Feature) {
    return mafBlockField(feature)
  }
}
