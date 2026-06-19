import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'
import { getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession, isUriLocation } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { generateAssembly } from './generateAssembly.ts'
import { generateTracks } from './ucscTrackHub.ts'
import {
  fetchGenomesFile,
  fetchTrackDbFile,
  formatHubLoadSummary,
  makeLocFromUri,
  resolve,
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

export async function doConnect(self: ConnectionDoConnectArg) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)
  const notLoadedAssemblies: string[] = []
  try {
    const hubFileLocation = getConf(self, 'hubTxtLocation')
    if (!isUriLocation(hubFileLocation)) {
      throw new Error('UCSC track hubs must be loaded from a URL')
    }
    const hubFileText = await openLocation(hubFileLocation).readFile('utf8')
    const hubUri = resolve(hubFileLocation.uri, hubFileLocation.baseUri)
    const { assemblyManager } = session
    if (hubFileText.includes('useOneFile on')) {
      const hub = new SingleFileHub(hubFileText)
      const { genome, tracks } = hub
      const genomeName = genome.name!

      if (!assemblyManager.get(genomeName)) {
        session.addSessionAssembly?.(generateAssembly(genome, hubUri))
      }
      const tracksNew = generateTracks({
        trackDb: tracks,
        trackDbLoc: hubFileLocation,
        assemblyName: genomeName,
        baseUrl: hubUri,
      })
      self.addTrackConfs(tracksNew)
      pluginManager.evaluateExtensionPoint('LaunchView-LinearGenomeView', {
        session,
        assembly: genomeName,
        tracklist: true,
        loc: genome.data.defaultPos,
      })
    } else {
      const hubFile = new HubFile(hubFileText)
      const genomeFile = hubFile.data.genomesFile
      if (!genomeFile) {
        throw new Error('genomesFile not found on hub')
      }

      const genomesLoc = makeLocFromUri(genomeFile, hubUri)
      const genomesFile = await fetchGenomesFile(genomesLoc)
      const assemblyNames = getConf(self, 'assemblyNames')
      const genomesBaseUri = genomesLoc.uri
      const trackCounts: Record<string, number> = {}
      for (const [genomeName, genome] of Object.entries(genomesFile.data)) {
        if (assemblyNames.length > 0 && !assemblyNames.includes(genomeName)) {
          continue
        }

        // mirror the single-file branch: auto-add an assembly the instance
        // doesn't already have, so a standard multi-genome hub still loads its
        // tracks. only skip when there's no way to add one (addSessionAssembly
        // absent)
        if (!assemblyManager.get(genomeName)) {
          if (session.addSessionAssembly) {
            session.addSessionAssembly(generateAssembly(genome, genomesBaseUri))
          } else {
            notLoadedAssemblies.push(genomeName)
            continue
          }
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

      session.notify(
        formatHubLoadSummary(trackCounts, notLoadedAssemblies),
        'success',
      )
    }
  } catch (e) {
    console.error(e)
    session.notifyError(`${getConf(self, 'name')}: "${e}"`, e)
    session.breakConnection?.(self.configuration)
  }
}
