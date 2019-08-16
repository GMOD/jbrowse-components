import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import {
  ConfigurationReference,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'
import {
  fetchGenomesFile,
  fetchHubFile,
  fetchTrackDbFile,
  generateTracks,
  ucscAssemblies,
} from './ucscTrackHub'

export default function(pluginManager) {
  return types.compose(
    'UCSCTrackHubConnection',
    connectionModelFactory(pluginManager),
    types
      .model({ configuration: ConfigurationReference(configSchema) })
      .actions(self => ({
        connect() {
          const connectionName = readConfObject(self.configuration, 'name')
          const hubFileLocation = readConfObject(
            self.configuration,
            'hubTxtLocation',
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
              const assemblyName = readConfObject(self.assemblyConf, 'name')
              if (!genomesFile.has(assemblyName))
                throw new Error(
                  `Assembly "${assemblyName}" not in genomes file from connection "${connectionName}"`,
                )
              const twoBitPath = genomesFile.get(assemblyName).get('twoBitPath')
              let sequence
              if (twoBitPath) {
                let twoBitLocation
                if (hubFileLocation.uri)
                  twoBitLocation = {
                    uri: new URL(
                      twoBitPath,
                      new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
                    ).href,
                  }
                else
                  twoBitLocation = {
                    localPath: twoBitPath,
                  }
                sequence = {
                  type: 'ReferenceSequenceTrack',
                  adapter: {
                    type: 'TwoBitAdapter',
                    twoBitLocation,
                  },
                }
              } else if (ucscAssemblies.includes(assemblyName))
                sequence = {
                  type: 'ReferenceSequenceTrack',
                  adapter: {
                    type: 'TwoBitAdapter',
                    twoBitLocation: {
                      uri: `http://hgdownload.soe.ucsc.edu/goldenPath/${assemblyName}/bigZips/${assemblyName}.2bit`,
                    },
                  },
                }
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
                sequence,
              ])
            })
            .then(([trackDbFileLocation, trackDbFile, sequence]) => {
              const tracks = generateTracks(trackDbFile, trackDbFileLocation)
              self.setSequence(sequence)
              self.setTrackConfs(tracks)
            })
            .catch(error => {
              console.error(error)
            })
        },
      })),
  )
}
