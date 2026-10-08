import { readConfObject } from '@jbrowse/core/configuration'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { isLDRecordSource } from '@jbrowse/ld-core'
import { BedTabixAdapter } from '@jbrowse/plugin-bed'
import { defer, forkJoin, mergeMap, of, toArray } from 'rxjs'

import { LD_FIELD, LD_ROLE_FIELD } from './ldFields.ts'
import { INDEX_SNP_MISSING, ldOf, ldToIndex } from './ldJoin.ts'
import { getScoreTransform } from './scoreTransforms.ts'
import { TOP_HIT_FACT, topHitOf } from './topHit.ts'

import type { GWASAdapterConfig } from './configSchema.ts'
import type { GWASFetchOptions, LdJoin, LdToIndex } from './ldJoin.ts'
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

  // The window is the index's, not the fetched region's, so every fetch
  // under one index reads the same rows.
  private ldLookup: { key: string; lookup: LdToIndex } | undefined

  private async ldToIndex(join: LdJoin, opts: GWASFetchOptions) {
    const key = `${join.refName}:${join.start}`
    if (this.ldLookup?.key === key) {
      return this.ldLookup.lookup
    }
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
    const lookup = await updateStatus(
      'Downloading LD data',
      opts.statusCallback,
      () => ldToIndex(dataAdapter, join, opts),
    )
    this.ldLookup = { key, lookup }
    return lookup
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

  // The top hit is read here, before the join and every step of the plot, so
  // nothing a plot filters or draws moves the index the join follows.
  getFeatures(region: Region, opts: GWASFetchOptions = {}) {
    const { ld, facts } = opts
    return forkJoin([
      ld ? defer(() => this.ldToIndex(ld, opts)) : of(undefined),
      super.getFeatures(region, opts).pipe(toArray()),
    ]).pipe(
      mergeMap(([lookup, loaded]) => {
        const found = loaded.map(f =>
          ld && lookup ? ldOf(f, lookup, ld) : undefined,
        )
        const indexHeld = found.some(l => l?.role === 'index')
        const partnered = found.some(l => l?.role === 'partner')
        if (indexHeld && !partnered) {
          opts.notices?.push(INDEX_SNP_MISSING)
        }
        const features = loaded.map((f, i) => this.rewritten(f, found[i]))
        const top = facts && topHitOf(features)
        if (top) {
          facts[TOP_HIT_FACT] = top
        }
        return features
      }),
    )
  }
}
