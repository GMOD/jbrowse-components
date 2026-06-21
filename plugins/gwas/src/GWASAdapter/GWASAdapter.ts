import { readConfObject } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { BedTabixAdapter } from '@jbrowse/plugin-bed'
import { map } from 'rxjs'

import { getScoreTransform } from './scoreTransforms.ts'

import type { GWASAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

// A BedTabixAdapter that can remap its score column into Manhattan -log10(p)
// space (for files whose p-value column is a raw or natural-log p-value rather
// than pre-computed -log10). With scoreTransform 'none' (the default, and the
// Pan-UKBB flat-file case where columns are already -log10) the parent stream
// is returned untouched, so the genome-wide hot path is unchanged.
export default class GWASAdapter extends BedTabixAdapter {
  // narrow the inherited BedTabixAdapter config to include the GWAS slots, so
  // readConfObject('scoreTransform') resolves against the right schema
  declare config: GWASAdapterConfig

  getFeatures(region: Region, opts?: BaseOptions) {
    const transform = getScoreTransform(
      readConfObject(this.config, 'scoreTransform'),
    )
    const features = super.getFeatures(region, opts)
    return transform
      ? features.pipe(
          map(f => {
            const score = f.get('score')
            return score === undefined
              ? f
              : new SimpleFeature({ ...f.toJSON(), score: transform(score) })
          }),
        )
      : features
  }
}
