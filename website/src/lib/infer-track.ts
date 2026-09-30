import {
  adapterTypesToTrackTypeMap,
  isLooseTrackConfig,
  trackTypeForAdapter,
} from '../../../packages/add-track-core/src/index.ts'
import { guessTrackConfFromTable } from '../../../packages/core/src/util/formatGuessers.ts'
import { getFileName } from '../../../packages/core/src/util/getFileName.ts'

import type { FileLocation } from '../../../packages/core/src/util/types/data.ts'

export { isLooseTrackConfig }

function uriLocation(uri: string, baseUri?: unknown): FileLocation {
  return {
    uri,
    locationType: 'UriLocation',
    ...(typeof baseUri === 'string' ? { baseUri } : {}),
  }
}

export function guessAdapterType(uri: string) {
  return guessTrackConfFromTable(uriLocation(uri))?.adapter.type
}

export function guessTrackType(adapterType: string, uri: string) {
  return (
    trackTypeForAdapter(adapterType, getFileName(uriLocation(uri))) ??
    'FeatureTrack'
  )
}

export const syntenyAdapterTypes = new Set(
  Object.entries(adapterTypesToTrackTypeMap)
    .filter(([, trackType]) => trackType === 'SyntenyTrack')
    .map(([adapterType]) => adapterType),
)

export function expandTrackShorthand(
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (!isLooseTrackConfig(config)) {
    return config
  }
  const { uri, index, baseUri, ...extra } = config
  const guess = guessTrackConfFromTable(
    uriLocation(uri, baseUri),
    index === undefined ? undefined : uriLocation(index, baseUri),
  )
  return guess ? { ...guess, ...extra } : config
}
