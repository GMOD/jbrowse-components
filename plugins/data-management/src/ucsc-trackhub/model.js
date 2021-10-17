import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import {
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'
import {
  fetchGenomesFile,
  fetchHubFile,
  fetchTrackDbFile,
  generateTracks,
} from './ucscTrackHub'

export default function UCSCTrackHubConnection(pluginManager) {
  return types.compose(
    'UCSCTrackHubConnection',
    BaseConnectionModelFactory(pluginManager),
    types
      .model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('UCSCTrackHubConnection'),
      })
      .actions(self => ({
        connect() {
          const connectionName = getConf(self, 'name')
          const hubFileLocation = getConf(self, 'hubTxtLocation')
          const session = getSession(self)
          fetchHubFile(hubFileLocation)
            .then(hubFile => {
              const genomesFileLocation = hubFileLocation.uri
                ? {
                    uri: new URL(
                      hubFile.get('genomesFile'),
                      hubFileLocation.uri,
                    ).href,
                    locationType: 'UriLocation',
                  }
                : {
                    localPath: hubFile.get('genomesFile'),
                    locationType: 'LocalPathLocation',
                  }
              return Promise.all([
                hubFile,
                fetchGenomesFile(genomesFileLocation),
              ])
            })
            .then(([hubFile, genomesFile]) => {
              const trackDbData = []
              for (const [genomeName, genome] of genomesFile) {
                const assemblyNames = getConf(self, 'assemblyNames')
                if (
                  assemblyNames.length > 0 &&
                  !assemblyNames.includes(genomeName)
                ) {
                  break
                }
                const assemblyConf = session.assemblies.find(
                  assembly => readConfObject(assembly, 'name') === genomeName,
                )
                if (!assemblyConf) {
                  throw new Error(
                    `Cannot find assembly for "${genomeName}" from the genomes file for connection "${connectionName}"`,
                  )
                }
                const trackDbFileLocation = hubFileLocation.uri
                  ? {
                      uri: new URL(
                        genome.get('trackDb'),
                        new URL(
                          hubFile.get('genomesFile'),
                          hubFileLocation.uri,
                        ),
                      ).href,
                      locationType: 'UriLocation',
                    }
                  : {
                      localPath: genome.get('trackDb'),
                      locationType: 'LocalPathLocation',
                    }
                trackDbData.push(
                  Promise.all([
                    trackDbFileLocation,
                    fetchTrackDbFile(trackDbFileLocation),
                    genomeName,
                    assemblyConf,
                  ]),
                )
              }
              return Promise.all([...trackDbData])
            })
            .then(trackDbData => {
              for (const [
                trackDbFileLocation,
                trackDbFile,
                genomeName,
                assemblyConf,
              ] of trackDbData) {
                const sequenceAdapter = readConfObject(assemblyConf, [
                  'sequence',
                  'adapter',
                ])
                const tracks = generateTracks(
                  trackDbFile,
                  trackDbFileLocation,
                  genomeName,
                  sequenceAdapter,
                )
                self.addTrackConfs(tracks)
              }
            })
            .catch(error => {
              console.error(error)
              session.notify(
                `There was a problem connecting to the UCSC Track Hub "${self.name}". Please make sure you have entered a valid hub.txt file. The error that was thrown is: "${error}"`,
                'error',
              )
              session.breakConnection(self.configuration)
            })
        },
      })),
  )
}
