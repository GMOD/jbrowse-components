import { readConfObject } from '@jbrowse/core/configuration'
import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { isLDRecordSource } from '@jbrowse/ld-core'
import { BedTabixAdapter } from '@jbrowse/plugin-bed'
import { defer, forkJoin, mergeMap, of, toArray } from 'rxjs'

import { LD_FIELD, LD_ROLE_FIELD } from './ldFields.ts'
import { INDEX_SNP_MISSING, joinLd, ldToIndex } from './ldJoin.ts'
import { getScoreTransform } from './scoreTransforms.ts'
import { TOP_HIT_FACT, topHitsOf } from './topHit.ts'

import type { GWASAdapterConfig } from './configSchema.ts'
import type { GWASFetchOptions, JoinedLd, LdJoin, LdToIndex } from './ldJoin.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BedFeatureData } from '@jbrowse/plugin-bed'

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

  // The window is the index's, not the fetched region's, so every region
  // under one index shares one read, which only all of them aborting cancels.
  private ldLookup:
    | {
        key: string
        load: (opts: BaseOptions) => Promise<LdToIndex | undefined>
      }
    | undefined

  private ldToIndex(join: LdJoin, opts: GWASFetchOptions) {
    const key = `${join.refName}:${join.start}`
    if (this.ldLookup?.key !== key) {
      this.ldLookup = {
        key,
        load: cachedSetup({
          label: 'Downloading LD data',
          setup: ({ signal, statusCallback }) =>
            this.readLdToIndex(join, { signal, statusCallback }),
        }),
      }
    }
    return this.ldLookup.load(opts)
  }

  private async readLdToIndex(join: LdJoin, opts: BaseOptions) {
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
    return ldToIndex(dataAdapter, join, opts)
  }

  protected override featureOf(data: BedFeatureData) {
    const transform = this.scoreTransform
    if (transform && data.score !== undefined) {
      data.score = transform(data.score)
    }
    return super.featureOf(data)
  }

  private joined(f: Feature, ld?: JoinedLd) {
    return ld
      ? new SimpleFeature({
          ...f.toJSON(),
          [LD_FIELD]: ld.r2,
          [LD_ROLE_FIELD]: ld.role,
        })
      : f
  }

  // The top hits are read here, off the rescored file before every step of
  // the plot, so nothing a plot filters or draws moves the index the join
  // follows; the join writes no score, so it cannot move it either.
  getFeatures(region: Region, opts: GWASFetchOptions = {}) {
    const { ld, facts } = opts
    return forkJoin([
      ld ? defer(() => this.ldToIndex(ld, opts)) : of(undefined),
      super.getFeatures(region, opts).pipe(toArray()),
    ]).pipe(
      mergeMap(([lookup, loaded]) => {
        const { joined, unjoined } =
          ld && lookup
            ? joinLd(loaded, lookup, ld)
            : { joined: [], unjoined: false }
        if (unjoined) {
          opts.notices?.push(INDEX_SNP_MISSING)
        }
        const features = loaded.map((f, i) => this.joined(f, joined[i]))
        if (facts) {
          facts[TOP_HIT_FACT] = topHitsOf(features, region)
        }
        return features
      }),
    )
  }
}
