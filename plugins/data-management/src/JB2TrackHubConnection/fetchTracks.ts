import { openLocation } from '@jbrowse/core/util/io'

import { addRelativeUris } from './addRelativeUris.ts'
import { resolve } from './util.ts'

import type { FileLocation } from '@jbrowse/core/util'

export async function fetchJB2TrackHubTracks(
  config: Record<string, unknown>,
) {
  const configJsonLocation = config.configJsonLocation as FileLocation
  const configJson = JSON.parse(
    await openLocation(configJsonLocation).readFile('utf8'),
  )
  const configUri = resolve(
    // @ts-expect-error
    configJsonLocation.uri,
    // @ts-expect-error
    configJsonLocation.baseUri,
  )
  addRelativeUris(configJson, new URL(configUri))
  return (configJson.tracks as Record<string, unknown>[]) ?? []
}
