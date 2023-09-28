import {
  TrackDbFile,
  HubFile,
  GenomesFile,
  SingleFileHub,
} from '@gmod/ucsc-hub'
import {
  FileLocation,
  checkAbortSignal,
  isUriLocation,
  iterMap,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

/**
 * the UCSC connection configurator's unified representation of a hub file,
 * its genomes file, and trackDb files
 */
export class UnifiedHubData {
  constructor(
    public readonly hub: HubFile,
    public readonly hubBaseUri: string,
    public readonly genomes: GenomesFile,
    public readonly genomesBaseUri: string,
    public readonly trackDbs: { trackDb: TrackDbFile; baseUri: string }[],
  ) {}
}

export async function fetchAll(
  hubFileLocation: FileLocation,
  signal?: AbortSignal,
) {
  if (!isUriLocation(hubFileLocation)) {
    throw new Error('only uri locations are supported for hub files')
  }
  const hubFile = await fetchHubFile(hubFileLocation, signal)
  const hubFileUri = hubFileLocation.uri
  if (hubFile instanceof SingleFileHub) {
    return new UnifiedHubData(
      hubFile,
      hubFileUri,
      hubFile.genome,
      hubFileUri,
      hubFile.trackDbs.map(trackDb => {
        return { trackDb, baseUri: hubFileUri }
      }),
    )
  } else {
    // get the genomes file
    const genomeFileLocation = hubFile.get('genomesFile')
    if (!genomeFileLocation) {
      throw new Error('genomesFile not found on hub')
    }
    const genomesFileLocation = {
      uri: new URL(
        genomeFileLocation,
        new URL(hubFileLocation.uri, hubFileLocation.baseUri),
      ).href,
      locationType: 'UriLocation' as const,
    }
    const genomesFile = await fetchGenomesFile(genomesFileLocation, signal)

    // get the trackDb files for each genome
    const trackDbData = await Promise.all(
      iterMap(genomesFile.entries(), async ([genomeName, genome]) => {
        checkAbortSignal(signal)
        const db = genome.get('trackDb')
        if (!db) {
          throw new Error(`no trackDb provided for genome ${genomeName}`)
        }
        const base = new URL(genomeFileLocation, hubFileLocation.uri)
        const trackDbLoc = {
          uri: new URL(db, base).href,
          locationType: 'UriLocation' as const,
        }
        const trackDb = await fetchTrackDbFile(trackDbLoc, signal)
        return { trackDb, baseUri: trackDbLoc.uri }
      }),
    )
    return new UnifiedHubData(
      hubFile,
      hubFileUri,
      genomesFile,
      genomesFileLocation.uri,
      trackDbData,
    )
  }
}

export async function fetchHubFile(
  hubLocation: FileLocation,
  signal?: AbortSignal,
) {
  try {
    const hubFileText = await openLocation(hubLocation).readFile({
      encoding: 'utf8',
      signal,
    })
    if (hubFileText.match(/useOneFile\s+on/)) {
      return new SingleFileHub(hubFileText)
    }
    return new HubFile(hubFileText)
  } catch (error) {
    throw new Error(`Not a valid hub.txt file, got error: '${error}'`)
  }
}

export async function fetchGenomesFile(
  genomesLoc: FileLocation,
  signal?: AbortSignal,
) {
  const genomesFileText = await openLocation(genomesLoc).readFile({
    encoding: 'utf8',
    signal,
  })
  return new GenomesFile(genomesFileText)
}

export async function fetchTrackDbFile(
  trackDbLoc: FileLocation,
  signal?: AbortSignal,
) {
  const text = await openLocation(trackDbLoc).readFile({
    encoding: 'utf8',
    signal,
  })
  return new TrackDbFile(text)
}
