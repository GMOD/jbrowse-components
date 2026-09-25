import {
  createAttributeChannels,
  writeFeatureChannels,
} from './attributeChannels.ts'
import { makeStringDict } from './stringDict.ts'

import type { ColorFunctionInputs } from './colorFunctions.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * #api
 * The lanes `createComparativeColorFunction` reads, built from features a
 * display holds on the main thread rather than from a worker's payload. `ends`
 * answers a feature's two refNames in the order the colour modes read them:
 * `query` paints by the first and `target` by the second.
 */
export function featureColorInputs(
  features: readonly Feature[],
  ends: (feature: Feature) => readonly [string, string],
  channelNames: readonly string[],
): ColorFunctionInputs {
  const refNames = makeStringDict()
  const mateRefNames = makeStringDict()
  const refNameIds = new Uint32Array(features.length)
  const mateRefNameIds = new Uint32Array(features.length)
  const strands = new Int8Array(features.length)
  const channels = createAttributeChannels(channelNames, features.length)
  features.forEach((feature, i) => {
    const [first, second] = ends(feature)
    refNameIds[i] = refNames.idFor(first)
    mateRefNameIds[i] = mateRefNames.idFor(second)
    strands[i] = feature.get('strand') === -1 ? -1 : 1
    writeFeatureChannels(channels.list, i, feature)
  })
  return {
    strands,
    refNameDict: refNames.dict,
    refNameIds,
    mateRefNameDict: mateRefNames.dict,
    mateRefNameIds,
    ...channels.finish(features.length),
  }
}
