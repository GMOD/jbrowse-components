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
import {
  fetchGenomesFile,
  fetchHubFile,
  fetchTrackDbFile,
  generateTracks,
} from './ucscTrackHub'

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
        try {
          const connectionName = getConf(self, 'name')
          const hubFileLocation = getConf(self, 'hubTxtLocation')
          const hubFile = await fetchHubFile(hubFileLocation)
          const genomeFile = hubFile.get('genomesFile')
          if (!genomeFile) {
            throw new Error('genomesFile not found on hub')
          }

          const hubUri = hubFileLocation.uri
          const genomesFileLocation = hubUri
            ? {
                uri: new URL(genomeFile, hubUri).href,
                locationType: 'UriLocation',
              }
            : {
                localPath: genomeFile,
                locationType: 'LocalPathLocation',
              }
          const genomesFile = await fetchGenomesFile(genomesFileLocation)
          const trackDbData = []
          for (const [genomeName, genome] of genomesFile) {
            const assemblyNames = getConf(self, 'assemblyNames')
            if (
              assemblyNames.length > 0 &&
              !assemblyNames.includes(genomeName)
            ) {
              continue
            }
            const conf = session.assemblies.find(
              a => readConfObject(a, 'name') === genomeName,
            )
            if (!conf) {
              throw new Error(
                `Cannot find assembly for "${genomeName}" from the genomes file for connection "${connectionName}"`,
              )
            }
            const trackDb = genome.get('trackDb')
            if (!trackDb) {
              throw new Error('genomesFile not found on hub')
            }
            const trackDbFileLocation = hubUri
              ? {
                  uri: new URL(trackDb, new URL(genomeFile, hubUri)).href,
                  locationType: 'UriLocation',
                }
              : {
                  localPath: trackDb,
                  locationType: 'LocalPathLocation',
                }
            trackDbData.push([
              trackDbFileLocation,
              await fetchTrackDbFile(trackDbFileLocation),
              genomeName,
              conf,
            ] as const)
          }
          for (const [
            trackDbFileLocation,
            trackDbFile,
            genomeName,
            conf,
          ] of trackDbData) {
            const sequenceAdapter = readConfObject(conf, [
              'sequence',
              'adapter',
            ])
            self.addTrackConfs(
              generateTracks(
                trackDbFile,
                trackDbFileLocation,
                genomeName,
                sequenceAdapter,
              ),
            )
          }
        } catch (e) {
          console.error(e)
          session.notify(
            `There was a problem connecting to the UCSC Track Hub "${self.configuration.name}". Please make sure you have entered a valid hub.txt file. The error that was thrown is: "${e}"`,
            'error',
          )
          session.breakConnection(self.configuration)
        }
      },
    }))
}