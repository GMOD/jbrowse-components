import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'
import { getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { generateAssembly } from './generateAssembly.ts'
import { generateTracks } from './ucscTrackHub.ts'
import {
  fetchGenomesFile,
  fetchTrackDbFile,
  makeLocFromUri,
  resolve,
} from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { UriLocation } from '@jbrowse/core/util'

export async function doConnect(self: ConnectionDoConnectArg) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)
  const notLoadedAssemblies: string[] = []
  try {
    const hubFileLocation = getConf(self, 'hubTxtLocation') as UriLocation
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

      const genomesFile = await fetchGenomesFile(
        makeLocFromUri(genomeFile, hubUri),
      )
      const assemblyNames = getConf(self, 'assemblyNames')
      const genomesBaseUri = hubUri ? resolve(genomeFile, hubUri) : undefined
      const map: Record<string, number> = {}
      for (const [genomeName, genome] of Object.entries(genomesFile.data)) {
        if (assemblyNames.length > 0 && !assemblyNames.includes(genomeName)) {
          continue
        }

        const asm = assemblyManager.get(genomeName)
        if (!asm) {
          notLoadedAssemblies.push(genomeName)
          continue
        }

        const db = genome.data.trackDb
        if (!db) {
          throw new Error(`trackDb not found for ${genomeName}`)
        }
        const loc = makeLocFromUri(db, genomesBaseUri)
        const trackDb = await fetchTrackDbFile(loc)
        const tracks = generateTracks({
          trackDb,
          trackDbLoc: loc,
          assemblyName: genomeName,
          baseUrl: hubUri,
        })
        self.addTrackConfs(tracks)
        map[genomeName] = tracks.length
      }

      const loadedAssemblies = Object.entries(map)
      const str1 = loadedAssemblies.length
        ? `Loaded data from these assemblies: ${loadedAssemblies
            .map(([key, val]) => `${key} (${val} tracks)`)
            .join(', ')}`
        : ''
      const str2 = notLoadedAssemblies.length
        ? `Skipped data from these assemblies: ${notLoadedAssemblies.join(
            ', ',
          )}`
        : ''
      session.notify([str1, str2].filter(f => !!f).join('. '), 'success')
    }
  } catch (e) {
    console.error(e)
    session.notifyError(`${getConf(self, 'name')}: "${e}"`, e)
    session.breakConnection?.(self.configuration)
  }
}
