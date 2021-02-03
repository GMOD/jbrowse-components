import {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration/configurationSchema'
import { readConfObject } from '@jbrowse/core/configuration'
import objectHash from 'object-hash'
import { SnapshotIn } from 'mobx-state-tree'
import { fetchGenomesFile, fetchHubFile } from './ucscTrackHub'
import ucscAssemblies from './ucscAssemblies'

export async function getAssemblies(connectionConfig: AnyConfigurationModel) {
  const hubFileLocation = readConfObject(connectionConfig, 'hubTxtLocation')
  const hubFile = await fetchHubFile(hubFileLocation)
  let genomesFileLocation
  if ('uri' in hubFileLocation) {
    genomesFileLocation = {
      uri: new URL(hubFile.get('genomesFile'), hubFileLocation.uri).href,
    }
  } else {
    genomesFileLocation = { localPath: hubFile.get('genomesFile') }
  }
  const genomesFile = await fetchGenomesFile(genomesFileLocation)

  const assemblyConfigs: SnapshotIn<AnyConfigurationSchemaType>[] = []
  for (const [assemblyName, genome] of genomesFile) {
    const twoBitPath = genome.get('twoBitPath')
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
    } else if (ucscAssemblies.includes(assemblyName)) {
      sequence = {
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: {
            uri: `http://hgdownload.soe.ucsc.edu/goldenPath/${assemblyName}/bigZips/${assemblyName}.2bit`,
          },
        },
      }
    } else {
      throw new Error(
        `"${assemblyName}" in genomes file does not have twoBitPath specified and is not in the list of known UCSC assemblies`,
      )
    }
    assemblyConfigs.push({
      name: assemblyName,
      sequence: {
        ...sequence,
        trackId: `${assemblyName}-${objectHash(sequence)}`,
      },
    })
  }
  return assemblyConfigs
}
