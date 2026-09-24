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

export default class GWASAdapter extends BedTabixAdapter {
  declare config: GWASAdapterConfig

  private readonly scoreTransform: ((score: number) => number) | undefined

  constructor(...args: ConstructorParameters<typeof BedTabixAdapter>) {
    super(...args)
    this.scoreTransform = getScoreTransform(
      this.config.scoreTransform,
      this.pluginManager?.jexl,
    )
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
    const transform = this.scoreTransform
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
