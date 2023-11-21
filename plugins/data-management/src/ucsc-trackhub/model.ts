import PluginManager from '@jbrowse/core/PluginManager'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import {
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types } from 'mobx-state-tree'

// locals
import configSchema from './configSchema'

export default function UCSCTrackHubConnection(pluginManager: PluginManager) {
  return types
    .compose(
      'UCSCTrackHubConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('UCSCTrackHubConnection'),
      }),
    )
    .actions(self => ({
      async connect() {
        const session = getSession(self)
        const notLoadedAssemblies = [] as string[]
        try {
          const hubFileLocation = getConf(self, 'hubTxtLocation')
          const {
            generateTracks,
            fetchGenomesFile,
            fetchTrackDbFile,
            fetchHubFile,
          } = await import('./ucscTrackHub')
          const hubFile = await fetchHubFile(hubFileLocation)
          const genomeFile = hubFile.data.genomesFile
          if (!genomeFile) {
            throw new Error('genomesFile not found on hub')
          }

          const hubUri = new URL(hubFileLocation.uri, hubFileLocation.baseUri)
          const genomesFileLocation = hubUri
            ? {
                uri: new URL(genomeFile, hubUri).href,
                locationType: 'UriLocation' as const,
              }
            : {
                localPath: genomeFile,
                locationType: 'LocalPathLocation' as const,
              }
          const genomesFile = await fetchGenomesFile(genomesFileLocation)
          const map = {} as Record<string, number>
          for (const [genomeName, genome] of Object.entries(genomesFile)) {
            const assemblyNames = getConf(self, 'assemblyNames')
            if (
              assemblyNames.length > 0 &&
              !assemblyNames.includes(genomeName)
            ) {
              continue
            }

            const conf = session.assemblyManager.get(genomeName)?.configuration
            if (!conf) {
              notLoadedAssemblies.push(genomeName)
              continue
            }
            const db = genome.get('trackDb')
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
            const seqAdapter = readConfObject(conf, ['sequence', 'adapter'])
            const tracks = generateTracks(trackDb, loc, genomeName, seqAdapter)
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
        } catch (e) {
          console.error(e)
          session.notify(
            `There was a problem connecting to the UCSC Track Hub "${self.configuration.name}". Please make sure you have entered a valid hub.txt file. The error that was thrown is: "${e}"`,
            'error',
          )
          session.breakConnection?.(self.configuration)
        }
      },
    }))
}
