import { HubFile, SingleFileHub } from '@gmod/ucsc-hub'

import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { nanoid } from '@jbrowse/core/util/nanoid'
import {
  generateTracks,
  fetchGenomesFile,
  fetchTrackDbFile,
} from './ucscTrackHub'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'

function resolve(uri: string, baseUri: string) {
  return new URL(uri, baseUri).href
}

export async function doConnect(self: {
  configuration: AnyConfigurationModel
  addTrackConfs: (arg: Record<string, unknown>[]) => void
}) {
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
            type: 'ReferenceSequenceTrack',
            trackId: `${genomeName}-${nanoid()}`,
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation: {
                uri: resolve(genome.data.twoBitPath!, hubUri),
              },
              chromSizesLocation: {
                uri: resolve(genome.data.chromSizes!, hubUri),
              },
            },
          },
        })
      }
      const asm2 = assemblyManager.get(genomeName)
      const sequenceAdapter = getConf(asm2!, ['sequence', 'adapter'])
      const tracksNew = generateTracks({
        trackDb: tracks,
        trackDbLoc: hubFileLocation,
        assemblyName: genomeName,
        sequenceAdapter,
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
            uri: resolve(genomeFile, hubUri),
            locationType: 'UriLocation' as const,
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
              uri: new URL(db, base).href,
              locationType: 'UriLocation' as const,
            }
          : {
              localPath: db,
              locationType: 'LocalPathLocation' as const,
            }
        const trackDb = await fetchTrackDbFile(loc)
        const sequenceAdapter = getConf(asm, ['sequence', 'adapter'])
        const tracks = generateTracks({
          trackDb,
          trackDbLoc: loc,
          assemblyName: genomeName,
          sequenceAdapter,
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
