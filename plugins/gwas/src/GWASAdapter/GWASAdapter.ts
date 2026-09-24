import { readConfObject } from '@jbrowse/core/configuration'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { isLDRecordSource } from '@jbrowse/ld-core'
import { BedTabixAdapter } from '@jbrowse/plugin-bed'
import { from, map, mergeMap } from 'rxjs'

import { joinLd, ldToIndex } from './ldJoin.ts'
import { getScoreTransform } from './scoreTransforms.ts'

import type { GWASAdapterConfig } from './configSchema.ts'
import type { GWASFetchOptions, LdJoin } from './ldJoin.ts'
import type { Region } from '@jbrowse/core/util'

// A BedTabixAdapter that can remap its score column into Manhattan -log10(p)
// space (for files whose p-value column is a raw or natural-log p-value rather
// than pre-computed -log10). With scoreTransform 'none' (the default, and the
// Pan-UKBB flat-file case where columns are already -log10) the parent stream
// is returned untouched, so the genome-wide hot path is unchanged.
export default class GWASAdapter extends BedTabixAdapter {
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
        this.config.scoreTransform,
        this.pluginManager?.jexl,
      )
    }
    return this.scoreTransform
  }

  private async ldToIndex(
    region: Region,
    join: LdJoin,
    opts: GWASFetchOptions,
  ) {
    const config: Record<string, unknown> | undefined =
      readConfObject(this.config, 'ldAdapter') ?? undefined
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    const { dataAdapter } = await this.getSubAdapter(config)
    if (!isLDRecordSource(dataAdapter)) {
      throw new Error(
        `Adapter type "${config.type}" cannot supply LD records for coloring`,
      )
    }
    return updateStatus('Downloading LD data', opts.statusCallback, () =>
      ldToIndex(dataAdapter, region, join),
    )
  }

  getFeatures(region: Region, opts: GWASFetchOptions = {}) {
    const transform = this.getTransform()
    const features = super.getFeatures(region, opts)
    const scored = transform
      ? features.pipe(
          map(f => {
            const score = f.get('score')
            return score === undefined
              ? f
              : new SimpleFeature({ ...f.toJSON(), score: transform(score) })
          }),
        )
      : features
    const { ld } = opts
    return ld
      ? from(this.ldToIndex(region, ld, opts)).pipe(
          mergeMap(lookup =>
            lookup ? scored.pipe(map(f => joinLd(f, lookup, ld))) : scored,
          ),
        )
      : scored
  }
}
