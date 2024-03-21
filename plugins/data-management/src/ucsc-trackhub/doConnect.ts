import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'
import {
  generateTracks,
  fetchGenomesFile,
  fetchTrackDbFile,
} from './ucscTrackHub'

import { getConf } from '@jbrowse/core/configuration'
import { FileLocation, getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { nanoid } from '@jbrowse/core/util/nanoid'

function resolve(uri: string, baseUri: string) {
  return new URL(uri, baseUri).href
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function doConnect(self: any) {
  const session = getSession(self)
  const notLoadedAssemblies = [] as string[]
  try {
    const hubFileLocation = getConf(self, 'hubTxtLocation') as FileLocation
    const hubFileText = await openLocation(hubFileLocation).readFile('utf8')
    // @ts-expect-error
    const hubUri = resolve(hubFileLocation.uri, hubFileLocation.baseUri)
    const { assemblyManager } = session
    if (hubFileText.includes('useOneFile on')) {
      const hub = new SingleFileHub(hubFileText)
      const { genome, tracks } = hub
      const genomeName = genome.name!

      const asm = assemblyManager.get(genomeName)
      if (!asm) {
        // @ts-expect-error
        session.addSessionAssembly({
          name: genomeName,
          sequence: {
            adapter: {
              chromSizesLocation: {
                uri: resolve(genome.data.chromSizes, hubUri),
              },
              twoBitLocation: {
                uri: resolve(genome.data.twoBitPath, hubUri),
              },
              type: 'TwoBitAdapter',
            },
            trackId: `${genomeName}-${nanoid()}`,
            type: 'ReferenceSequenceTrack',
          },
        })
      }
      const asm2 = assemblyManager.get(genomeName)
      const sequenceAdapter = getConf(asm2!, ['sequence', 'adapter'])
      const tracksNew = generateTracks({
        assemblyName: genomeName,
        sequenceAdapter,
        trackDb: tracks,
        trackDbLoc: hubFileLocation,
      })
      self.addTrackConfs(tracksNew)
    } else {
      const hubFile = new HubFile(hubFileText)
      const genomeFile = hubFile.data.genomesFile
      if (!genomeFile) {
        throw new Error('genomesFile not found on hub')
      }

      // @ts-expect-error
      const hubUri = resolve(hubFileLocation.uri, hubFileLocation.baseUri)
      const genomesFileLocation = hubUri
        ? {
            locationType: 'UriLocation' as const,
            uri: resolve(genomeFile, hubUri),
          }
        : {
            localPath: genomeFile,
            locationType: 'LocalPathLocation' as const,
          }
      const genomesFile = await fetchGenomesFile(genomesFileLocation)
      const map = {} as Record<string, number>
      for (const [genomeName, genome] of Object.entries(genomesFile.data)) {
        const assemblyNames = getConf(self, 'assemblyNames')
        if (assemblyNames.length > 0 && !assemblyNames.includes(genomeName)) {
          continue
        }

        const asm = assemblyManager.get(genomeName)
        if (!asm) {
          notLoadedAssemblies.push(genomeName)
          continue
        }

        // @ts-expect-error
        const db = genome.data.trackDb
        if (!db) {
          throw new Error('genomesFile not found on hub')
        }
        const base = new URL(genomeFile, hubUri)
        const loc = hubUri
          ? {
              locationType: 'UriLocation' as const,
              uri: new URL(db, base).href,
            }
          : {
              localPath: db,
              locationType: 'LocalPathLocation' as const,
            }
        const trackDb = await fetchTrackDbFile(loc)
        const sequenceAdapter = getConf(asm, ['sequence', 'adapter'])
        const tracks = generateTracks({
          assemblyName: genomeName,
          sequenceAdapter,
          trackDb,
          trackDbLoc: loc,
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
