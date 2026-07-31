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
  // type-only refinement of the inherited config so readConfObject resolves the
  // GWAS-only slots (e.g. scoreTransform) against the right schema
  declare config: GWASAdapterConfig

  // getFeatures runs per block, so the mode is resolved (and a `jexl:`
  // expression parsed) once per adapter instance rather than per region. Held
  // behind a separate `resolved` flag because `undefined` is itself a meaningful
  // result — the `none` fast path, where the feature stream isn't wrapped at all.
  private scoreTransform: ((score: number) => number) | undefined
  private scoreTransformResolved = false

  private getTransform() {
    if (!this.scoreTransformResolved) {
      this.scoreTransformResolved = true
      this.scoreTransform = getScoreTransform(
        readConfObject(this.config, 'scoreTransform'),
        this.pluginManager?.jexl,
      )
    }
    return this.scoreTransform
  }

  getFeatures(region: Region, opts?: BaseOptions) {
    const transform = this.getTransform()
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
