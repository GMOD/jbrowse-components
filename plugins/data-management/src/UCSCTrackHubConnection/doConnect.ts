import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'
import { getConf } from '@jbrowse/core/configuration'
import {
  getEnv,
  getSession,
  isLocalPathLocation,
  isUriLocation,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { generateAssembly } from './generateAssembly.ts'
import { generateTracks } from './ucscTrackHub.ts'
import {
  fetchGenomesFile,
  fetchTrackDbFile,
  formatHubLoadSummary,
  hubBaseUrl,
  makeLocFromUri,
} from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { RaStanza } from '@gmod/ucsc-hub'

// fetch a single genome's trackDb (resolved against the genomes.txt location)
// and convert it into jbrowse track configs
async function loadGenomeTracks({
  genome,
  genomeName,
  genomesBaseUri,
  hubUri,
}: {
  genome: RaStanza
  genomeName: string
  genomesBaseUri: string
  hubUri: string
}) {
  const db = genome.data.trackDb
  if (!db) {
    throw new Error(`trackDb not found for ${genomeName}`)
  }
  const loc = makeLocFromUri(db, genomesBaseUri)
  const trackDb = await fetchTrackDbFile(loc)
  return generateTracks({
    trackDb,
    trackDbLoc: loc,
    assemblyName: genomeName,
    baseUrl: hubUri,
  })
}

// make sure a hub genome is available to attach tracks to: present already, or
// added as a session assembly. Returns false only when it's absent and the
// session can't add assemblies.
function ensureAssembly(
  session: ReturnType<typeof getSession>,
  genome: RaStanza,
  genomeName: string,
  baseUri: string,
) {
  if (session.assemblyManager.get(genomeName)) {
    return true
  } else if (session.addSessionAssembly) {
    session.addSessionAssembly(generateAssembly(genome, baseUri))
    return true
  } else {
    return false
  }
}

// lazyConnect wraps this in the shared connect-failure handler
export async function doConnect(self: ConnectionDoConnectArg) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)
  const hubFileLocation = getConf(self, 'hubTxtLocation')
  if (!isUriLocation(hubFileLocation) && !isLocalPathLocation(hubFileLocation)) {
    throw new Error('UCSC track hubs must be loaded from a URL or local file')
  }
  const hubFileText = await openLocation(hubFileLocation).readFile('utf8')
  const hubUri = hubBaseUrl(hubFileLocation)

  if (hubFileText.includes('useOneFile on')) {
    const { genome, tracks } = new SingleFileHub(hubFileText)
    const genomeName = genome.name!
    if (!ensureAssembly(session, genome, genomeName, hubUri)) {
      // the hub's single genome isn't present and can't be added, so its tracks
      // would have nowhere to attach
      throw new Error(
        `Cannot load hub: assembly ${genomeName} is not present and this session cannot add assemblies`,
      )
    }
    self.addTrackConfs(
      generateTracks({
        trackDb: tracks,
        trackDbLoc: hubFileLocation,
        assemblyName: genomeName,
        baseUrl: hubUri,
      }),
    )
    if (!self.silent) {
      pluginManager.evaluateExtensionPoint('LaunchView-LinearGenomeView', {
        session,
        assembly: genomeName,
        tracklist: true,
        loc: genome.data.defaultPos,
      })
    }
  } else {
    const genomeFile = new HubFile(hubFileText).data.genomesFile
    if (!genomeFile) {
      throw new Error('genomesFile not found on hub')
    }
    const genomesLoc = makeLocFromUri(genomeFile, hubUri)
    const genomesFile = await fetchGenomesFile(genomesLoc)
    const assemblyNames = getConf(self, 'assemblyNames')
    const genomesBaseUri = hubBaseUrl(genomesLoc)
    const trackCounts: Record<string, number> = {}
    const notLoadedAssemblies: string[] = []
    for (const [genomeName, genome] of Object.entries(genomesFile.data)) {
      if (assemblyNames.length > 0 && !assemblyNames.includes(genomeName)) {
        continue
      }
      // auto-add an assembly the instance doesn't already have, so a standard
      // multi-genome hub still loads its tracks; only skip when there's no way
      // to add one
      if (!ensureAssembly(session, genome, genomeName, genomesBaseUri)) {
        notLoadedAssemblies.push(genomeName)
        continue
      }
      const tracks = await loadGenomeTracks({
        genome,
        genomeName,
        genomesBaseUri,
        hubUri,
      })
      self.addTrackConfs(tracks)
      trackCounts[genomeName] = tracks.length
    }

    if (!self.silent) {
      session.notify(
        formatHubLoadSummary(trackCounts, notLoadedAssemblies),
        'success',
      )
    }
  }
}
