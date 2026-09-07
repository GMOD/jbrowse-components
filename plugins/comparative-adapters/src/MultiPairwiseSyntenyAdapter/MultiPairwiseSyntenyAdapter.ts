import {
  cachedSetup,
  isFeatureAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { adapterAssemblyNames, readLodTierInfo } from '@jbrowse/synteny-core'
import { merge } from 'rxjs'
import { map } from 'rxjs/operators'

import { ComparativeAdapterBase } from '../ComparativeAdapterBase.ts'
import { AssemblyNotInAdapterError } from '../PairwiseAdapterBase.ts'
import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { MultiPairwiseSyntenyAdapterConfig } from './configSchema.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { ComparativeOptions } from '@jbrowse/synteny-core'
import type { LodTierInfo } from '@jbrowse/synteny-core'

export interface StarChild<T = BaseFeatureDataAdapter> {
  index: number
  assemblyNames: string[]
  adapter: T
}

export interface Star<T = BaseFeatureDataAdapter> {
  anchor: string
  children: StarChild<T>[]
}

/**
 * What `CoreGetInfo` answers for the star: the tier facts the LOD resolver
 * reads, plus the anchor and the lane assemblies, which the main thread can
 * otherwise only learn by reading every child config itself.
 */
export interface MultiPairwiseSyntenyInfo extends LodTierInfo {
  anchorAssemblyName: string
  assemblyNames: string[]
}

export class NoCommonAssemblyError extends Error {
  override name = 'NoCommonAssemblyError'

  constructor(common: string[], childNames: string[][]) {
    super(
      common.length === 0
        ? `MultiPairwiseSyntenyAdapter children share no assembly, so there is no anchor: ${childNames.map(names => `[${names.join(', ')}]`).join(' ')}`
        : `MultiPairwiseSyntenyAdapter children share ${common.length} assemblies (${common.join(', ')}) where the anchor has to be the only one`,
    )
  }
}

/**
 * The one assembly every child names. Reading it off the children rather than
 * a slot means the config never states it twice, and the failure mode of a
 * child with a typo in its pair is an error naming every child's pair rather
 * than a lane that is quietly missing.
 */
export function commonAssembly(childNames: string[][]) {
  const [first = [], ...rest] = childNames
  const common = [...new Set(first)].filter(name =>
    rest.every(names => names.includes(name)),
  )
  if (common.length !== 1) {
    throw new NoCommonAssemblyError(common, childNames)
  }
  return common[0]!
}

/**
 * The children a region query reaches: those naming the queried assembly, and
 * when a target is named, those naming both. That one rule covers every case
 * a star has — anchor with no target reaches every child, anchor with a target
 * reaches the child holding that pair, a mate reaches its own child (which a
 * PIF answers from the mate side, with the anchor as the mate), and two mates
 * reach nothing, which is the empty answer rather than an error the display
 * expects when it asks adjacent mate lanes for a direct link.
 */
export function childrenFor<T>(
  star: Star<T>,
  assemblyName: string | undefined,
  targetAssemblyName: string | undefined,
) {
  const named = star.children.filter(
    child =>
      assemblyName !== undefined && child.assemblyNames.includes(assemblyName),
  )
  if (named.length === 0) {
    throw new AssemblyNotInAdapterError(assemblyName, starAssemblyNames(star))
  }
  return targetAssemblyName === undefined
    ? named
    : named.filter(child => child.assemblyNames.includes(targetAssemblyName))
}

export function starAssemblyNames<T>(star: Star<T>) {
  return [
    star.anchor,
    ...new Set(
      star.children.flatMap(child =>
        child.assemblyNames.filter(name => name !== star.anchor),
      ),
    ),
  ]
}

function isAdapterConf(
  conf: unknown,
): conf is Record<string, unknown> & { type: string } {
  return (
    typeof conf === 'object' &&
    conf !== null &&
    'type' in conf &&
    typeof conf.type === 'string'
  )
}

function readChildConfs(conf: unknown) {
  if (!Array.isArray(conf) || conf.length === 0) {
    throw new Error(
      'MultiPairwiseSyntenyAdapter needs `adapters`: a non-empty array of pairwise synteny adapter configs',
    )
  }
  return conf.map((child: unknown, i) => {
    if (!isAdapterConf(child)) {
      throw new Error(
        `MultiPairwiseSyntenyAdapter adapters[${i}] is not an adapter config with a \`type\``,
      )
    }
    return child
  })
}

/**
 * A child's feature re-keyed so the star's ids stay distinct: the indexed
 * adapters key on a file offset, and two files have the same offsets. The
 * multiway display groups pairwise records on `syntenyId` before `id()`, so
 * both carry the child index or two children's rows would fold into one group.
 */
function rekey(index: number, feature: Feature) {
  const data: SimpleFeatureSerialized = {
    ...feature.toJSON(),
    uniqueId: `${index}-${feature.id()}`,
  }
  if (data.syntenyId !== undefined) {
    data.syntenyId = `${index}:${data.syntenyId}`
  }
  return new SyntenyFeature(data)
}

export default class MultiPairwiseSyntenyAdapter extends ComparativeAdapterBase<MultiPairwiseSyntenyAdapterConfig> {
  private star = cachedSetup({
    setup: async () => {
      const getSubAdapter = this.getSubAdapter
      if (getSubAdapter === undefined) {
        throw new Error('no getSubAdapter available')
      }
      const confs = readChildConfs(this.getConf('adapters'))
      const children = await Promise.all(
        confs.map(async (conf, index): Promise<StarChild> => {
          const { dataAdapter } = await getSubAdapter(conf)
          if (!isFeatureAdapter(dataAdapter)) {
            throw new Error(
              `MultiPairwiseSyntenyAdapter adapters[${index}] (${conf.type}) does not serve features`,
            )
          }
          return {
            index,
            assemblyNames: adapterAssemblyNames(conf),
            adapter: dataAdapter,
          }
        }),
      )
      const star: Star = {
        anchor: commonAssembly(children.map(child => child.assemblyNames)),
        children,
      }
      return star
    },
  })

  async getHeader(opts: ComparativeOptions = {}) {
    const star = await this.star(opts)
    const tiers = await Promise.all(
      star.children.map(async child =>
        readLodTierInfo(await child.adapter.getHeader(opts)),
      ),
    )
    const gaps = tiers.flatMap(tier =>
      tier?.coarseGap === undefined ? [] : [tier.coarseGap],
    )
    const info: MultiPairwiseSyntenyInfo = {
      hasCoarseTier: tiers.every(tier => tier?.hasCoarseTier === true),
      coarseGap: gaps.length === 0 ? undefined : Math.max(...gaps),
      anchorAssemblyName: star.anchor,
      assemblyNames: starAssemblyNames(star),
    }
    return info
  }

  async getRefNames(opts: ComparativeOptions = {}) {
    const { assemblyName } = opts
    const star = await this.star(opts)
    const holders =
      assemblyName === undefined
        ? []
        : star.children.filter(child =>
            child.assemblyNames.includes(assemblyName),
          )
    const names = await Promise.all(
      holders.map(child => child.adapter.getRefNames(opts)),
    )
    return [...new Set(names.flat())]
  }

  getFeatures(region: Region, opts: ComparativeOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const star = await this.star(opts)
      const children = childrenFor(
        star,
        region.assemblyName,
        opts.targetAssemblyName,
      )
      const slot = createStatusFanOut(opts.statusCallback)
      merge(
        ...children.map(child =>
          child.adapter
            .getFeatures(region, { ...opts, statusCallback: slot() })
            .pipe(map(feature => rekey(child.index, feature))),
        ),
      ).subscribe(observer)
    }, opts.stopToken)
  }
}
