import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import {
  ConfigurationReference,
  readConfObject,
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
          const connectionName = readConfObject(self.configuration, 'name')
          const hubFileLocation = readConfObject(
            self.configuration,
            'hubTxtLocation',
          )
          const session = getSession(self)
          fetchHubFile(hubFileLocation)
            .then(hubFile => {
              let genomesFileLocation
              if (hubFileLocation.uri) {
                genomesFileLocation = {
                  uri: new URL(hubFile.get('genomesFile'), hubFileLocation.uri)
                    .href,
                }
              } else {
                genomesFileLocation = { localPath: hubFile.get('genomesFile') }
              }
              return Promise.all([
                hubFile,
                fetchGenomesFile(genomesFileLocation),
              ])
            })
            .then(([hubFile, genomesFile]) => {
              const trackDbData = []
              for (const [genomeName, genome] of genomesFile) {
                const assemblyNames = readConfObject(
                  self.configuration,
                  'assemblyNames',
                )
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
                let trackDbFileLocation
                if (hubFileLocation.uri) {
                  trackDbFileLocation = {
                    uri: new URL(
                      genome.get('trackDb'),
                      new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
                    ).href,
                  }
                } else {
                  trackDbFileLocation = {
                    localPath: genome.get('trackDb'),
                  }
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
