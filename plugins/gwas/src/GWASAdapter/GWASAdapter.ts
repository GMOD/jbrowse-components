import { readConfObject } from '@jbrowse/core/configuration'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { isLDRecordSource } from '@jbrowse/ld-core'
import { BedTabixAdapter } from '@jbrowse/plugin-bed'
import { defer, forkJoin, map, mergeMap, toArray } from 'rxjs'

import { LD_FIELD, LD_ROLE_FIELD } from './ldFields.ts'
import { INDEX_SNP_MISSING, ldOf, ldToIndex } from './ldJoin.ts'
import { getScoreTransform } from './scoreTransforms.ts'

import type { GWASAdapterConfig } from './configSchema.ts'
import type { GWASFetchOptions, LdJoin } from './ldJoin.ts'
import type { Feature, Region } from '@jbrowse/core/util'

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

  private async ldToIndex(join: LdJoin, opts: GWASFetchOptions) {
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
      ldToIndex(dataAdapter, join, opts),
    )
  }

  private rewritten(f: Feature, ld?: ReturnType<typeof ldOf>) {
    const transform = this.scoreTransform
    const score = f.get('score')
    const rescored = transform !== undefined && score !== undefined
    return rescored || ld
      ? new SimpleFeature({
          ...f.toJSON(),
          ...(rescored ? { score: transform(score) } : {}),
          ...(ld ? { [LD_FIELD]: ld.r2, [LD_ROLE_FIELD]: ld.role } : {}),
        })
      : f
  }

  getFeatures(region: Region, opts: GWASFetchOptions = {}) {
    const features = super.getFeatures(region, opts)
    const { ld } = opts
    if (!ld) {
      return this.scoreTransform
        ? features.pipe(map(f => this.rewritten(f)))
        : features
    }
    return forkJoin([
      defer(() => this.ldToIndex(ld, opts)),
      features.pipe(toArray()),
    ]).pipe(
      mergeMap(([lookup, loaded]) => {
        const found = loaded.map(f => lookup && ldOf(f, lookup, ld))
        const indexHeld = found.some(l => l?.role === 'index')
        const partnered = found.some(l => l?.role === 'partner')
        if (indexHeld && !partnered) {
          opts.notices?.push(INDEX_SNP_MISSING)
        }
        return loaded.map((f, i) => this.rewritten(f, found[i]))
      }),
    )
  }
}
