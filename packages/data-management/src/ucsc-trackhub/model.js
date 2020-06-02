import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import {
  ConfigurationReference,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'
import {
  fetchGenomesFile,
  fetchHubFile,
  fetchTrackDbFile,
  generateTracks,
} from './ucscTrackHub'

export default function (pluginManager) {
  return types.compose(
    'UCSCTrackHubConnection',
    connectionModelFactory(pluginManager),
    types
      .model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('UCSCTrackHubConnection'),
      })
      .actions(self => ({
        connect() {
          const connectionName = readConfObject(self.configuration, 'name')
          const hubFileLocation = readConfObject(
            self.configuration,
            'hubTxtLocation',
          )
          const assemblyName = readConfObject(
            self.configuration,
            'assemblyName',
          )
          const session = getSession(self)
          const assemblyConf = session.assemblies.find(
            assembly => readConfObject(assembly, 'name') === assemblyName,
          )
          fetchHubFile(hubFileLocation)
            .then(hubFile => {
              let genomesFileLocation
              if (hubFileLocation.uri)
                genomesFileLocation = {
                  uri: new URL(hubFile.get('genomesFile'), hubFileLocation.uri)
                    .href,
                }
              else
                genomesFileLocation = { localPath: hubFile.get('genomesFile') }
              return Promise.all([
                hubFile,
                fetchGenomesFile(genomesFileLocation),
              ])
            })
            .then(([hubFile, genomesFile]) => {
              if (!genomesFile.has(assemblyName))
                throw new Error(
                  `Assembly "${assemblyName}" not in genomes file from connection "${connectionName}"`,
                )
              // const twoBitPath = genomesFile.get(assemblyName).get('twoBitPath')
              let trackDbFileLocation
              if (hubFileLocation.uri)
                trackDbFileLocation = {
                  uri: new URL(
                    genomesFile.get(assemblyName).get('trackDb'),
                    new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
                  ).href,
                }
              else
                trackDbFileLocation = {
                  localPath: genomesFile.get(assemblyName).get('trackDb'),
                }
              return Promise.all([
                trackDbFileLocation,
                fetchTrackDbFile(trackDbFileLocation),
              ])
            })
            .then(([trackDbFileLocation, trackDbFile]) => {
              const sequenceAdapter = readConfObject(assemblyConf, [
                'sequence',
                'adapter',
              ])
              const tracks = generateTracks(
                trackDbFile,
                trackDbFileLocation,
                assemblyName,
                sequenceAdapter,
              )
              self.setTrackConfs(tracks)
            })
            .catch(error => {
              console.error(error)
              session.notify(
                `There was a problem connecting to the UCSC Track Hub "${self.name}". Please make sure you have entered a valid hub.txt file. The error that was thrown is: "${error}"`,
              )
              session.breakConnection(self.configuration)
            })
        },
      })),
  )
}
