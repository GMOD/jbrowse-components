import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { modificationData } from './shared/modificationData.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AugmentedRegion, Feature } from '@jbrowse/core/util'

export function getTagAlt(feature: Feature, tag: string, alt: string) {
  const tags = feature.get('tags') as Record<string, unknown> | undefined
  return tags?.[tag] ?? tags?.[alt]
}

export async function fetchSequence(
  region: AugmentedRegion,
  adapter: BaseFeatureDataAdapter,
) {
  const { start, end, originalRefName, refName } = region

  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        ...region,
        refName: originalRefName || refName,
        end,
        start,
      })
      .pipe(toArray()),
  )
  return feats[0]?.get('seq') as string | undefined
}

export function randomColor(str: string) {
  let sum = 0

  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return `hsl(${sum * 10}, 20%, 50%)`
}

export function getColorForModification(str: string) {
  return modificationData[str]?.color || randomColor(str)
}

export { modificationData } from './shared/modificationData.ts'
