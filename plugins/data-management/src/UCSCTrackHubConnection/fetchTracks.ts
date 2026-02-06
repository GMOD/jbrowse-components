import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'
import { openLocation } from '@jbrowse/core/util/io'

import { generateTracks } from './ucscTrackHub.ts'
import { fetchGenomesFile, fetchTrackDbFile, resolve } from './util.ts'

import type { FileLocation } from '@jbrowse/core/util'

export async function fetchUCSCTrackHubTracks(
  config: Record<string, unknown>,
) {
  const hubTxtLocation = config.hubTxtLocation as FileLocation
  const assemblyNames = (config.assemblyNames as string[] | undefined) ?? []
  const hubFileText = await openLocation(hubTxtLocation).readFile('utf8')
  // @ts-expect-error
  const hubUri = resolve(hubTxtLocation.uri, hubTxtLocation.baseUri)

  if (hubFileText.includes('useOneFile on')) {
    const hub = new SingleFileHub(hubFileText)
    const { genome, tracks } = hub
    const genomeName = genome.name!
    return generateTracks({
      trackDb: tracks,
      trackDbLoc: hubTxtLocation,
      assemblyName: genomeName,
      baseUrl: hubUri,
    })
  } else {
    const hubFile = new HubFile(hubFileText)
    const genomeFile = hubFile.data.genomesFile
    if (!genomeFile) {
      throw new Error('genomesFile not found on hub')
    }

    const genomesFileLocation = hubUri
      ? {
          uri: resolve(genomeFile, hubUri),
          locationType: 'UriLocation' as const,
        }
      : {
          localPath: genomeFile,
          locationType: 'LocalPathLocation' as const,
        }
    const genomesFile = await fetchGenomesFile(genomesFileLocation)
    const allTracks: Record<string, unknown>[] = []
    for (const [genomeName, genome] of Object.entries(genomesFile.data)) {
      if (assemblyNames.length > 0 && !assemblyNames.includes(genomeName)) {
        continue
      }

      const db = genome.data.trackDb
      if (!db) {
        continue
      }
      const base = new URL(genomeFile, hubUri)
      const loc = hubUri
        ? {
            uri: new URL(db, base).href,
            locationType: 'UriLocation' as const,
          }
        : {
            localPath: db,
            locationType: 'LocalPathLocation' as const,
          }
      const trackDb = await fetchTrackDbFile(loc)
      const tracks = generateTracks({
        trackDb,
        trackDbLoc: loc,
        assemblyName: genomeName,
        baseUrl: hubUri,
      })
      for (const track of tracks) {
        allTracks.push(track)
      }
    }
    return allTracks
  }
}
