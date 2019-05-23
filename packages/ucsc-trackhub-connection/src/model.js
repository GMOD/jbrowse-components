import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { flow, types } from 'mobx-state-tree'
import {
  fetchGenomesFile,
  fetchHubFile,
  fetchTrackDbFile,
  generateTracks,
} from './ucscTrackHub'

export default function modelFactory(pluginManager) {
  return types
    .model('Connection', {
      assemblies: types.map(
        types
          .model('Assembly', {
            assemblyName: types.identifier,
            tracks: types.array(
              pluginManager.pluggableConfigSchemaType('track'),
            ),
          })
          .actions(self => ({
            addTrackConf(typeName, data) {
              const type = pluginManager.getTrackType(typeName)
              if (!type) throw new Error(`unknown track type ${typeName}`)
              const schemaType = type.configSchema
              const conf = schemaType.create(
                Object.assign({ type: typeName }, data),
              )
              self.tracks.push(conf)
              return conf
            },
          })),
      ),
    })
    .actions(self => ({
      clear() {
        self.assemblies.clear()
      },

      addEmptyAssembly(assemblyName) {
        self.assemblies.set(assemblyName, { assemblyName })
      },

      connect: flow(function* connect(connectionConf) {
        self.clear()
        const hubFileLocation = readConfObject(connectionConf, 'hubTxtLocation')
        const hubFile = yield fetchHubFile(hubFileLocation)
        let genomesFileLocation
        if (hubFileLocation.uri)
          genomesFileLocation = {
            uri: new URL(hubFile.get('genomesFile'), hubFileLocation.uri).href,
          }
        else genomesFileLocation = { localPath: hubFile.get('genomesFile') }
        const genomesFile = yield fetchGenomesFile(genomesFileLocation)
        let assemblyNames = readConfObject(connectionConf, 'assemblyNames')
        if (!assemblyNames.length) assemblyNames = genomesFile.keys()
        for (const assemblyName of assemblyNames) {
          self.addEmptyAssembly(assemblyName)
          // const twoBitPath = genomesFile.get(assemblyName).get('twoBitPath')
          // if (twoBitPath) {
          //   let twoBitLocation
          //   if (hubFileLocation.uri)
          //     twoBitLocation = {
          //       uri: new URL(
          //         twoBitPath,
          //         new URL(hubFile.get('genomesFile'), hubFileLocation.uri),
          //       ).href,
          //     }
          //   else
          //     twoBitLocation = {
          //       localPath: twoBitPath,
          //     }
          //   self.addAssembly(
          //     assemblyName,
          //     undefined,
          //     undefined,
          //     {
          //       type: 'ReferenceSequence',
          //       adapter: {
          //         type: 'TwoBitAdapter',
          //         twoBitLocation,
          //       },
          //     },
          //     readConfObject(connectionConf, 'connectionName'),
          //   )
          // } else if (ucscAssemblies.includes(assemblyName))
          //   self.addAssembly(
          //     assemblyName,
          //     undefined,
          //     undefined,
          //     {
          //       type: 'ReferenceSequence',
          //       adapter: {
          //         type: 'TwoBitAdapter',
          //         twoBitLocation: {
          //           uri: `http://hgdownload.soe.ucsc.edu/goldenPath/${assemblyName}/bigZips/${assemblyName}.2bit`,
          //         },
          //       },
          //     },
          //     readConfObject(connectionConf, 'connectionName'),
          //   )
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
          const trackDbFile = yield fetchTrackDbFile(trackDbFileLocation)
          const tracks = generateTracks(trackDbFile, trackDbFileLocation)
          tracks.forEach(track =>
            self.assemblies.get(assemblyName).addTrackConf(track.type, track),
          )
        }
      }),
    }))
}
