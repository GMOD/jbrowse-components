import { AbstractSessionModel, getSession } from '@jbrowse/core/util'
import { UCSCConnectionModel } from '.'
import { UnifiedHubData } from '../fetching-utils'
import { AnyConfigurationModel, getConf } from '@jbrowse/core/configuration'
import { AssemblyConfigModel } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { RaFile, RaStanza } from '@gmod/ucsc-hub'

function getUrl(file: RaFile, section: RaStanza, key: string) {
  if (section.has(key)) {
    const url = section.get(key)
    if (!url) {
      return url
    }
    return new URL(url, file.uri).href
  }
  return
}

/** configure any necessary assemblies in our JBrowse */
export async function configureAssemblies(
  hubData: UnifiedHubData,
  connectionModel: UCSCConnectionModel,
) {
  const session = getSession(connectionModel)
  const genomesFile = hubData.genomes

  const assemblies = new Map<string, AssemblyConfigModel>()
  for (const [genomeName, genome] of genomesFile) {
    // If we have `assemblyNames` configured in the connection's conf file,
    // we limit our processing to only the ones specified there.
    // Skip any others.
    const specifiedAssemblyNames = getConf(connectionModel, 'assemblyNames')
    if (
      specifiedAssemblyNames.length > 0 &&
      !specifiedAssemblyNames.includes(genomeName)
    ) {
      continue
    }

    const assemblyConf = session.assemblyManager.get(genomeName)?.configuration
    if (assemblyConf) {
      assemblies.set(genomeName, assemblyConf)
      continue
    }

    // TODO: try harder to match assemblies, maybe configuring refname aliases on the fly

    // we can't find a matching assembly, make a new one in our JBrowse
    const twoBitLocation = {
      uri: getUrl(genomesFile, genome, 'twoBitPath'),
      type: 'UriLocation',
    }
    const chromSizesLocation = {
      uri: getUrl(genomesFile, genome, 'chromSizes'),
      type: 'UriLocation',
    }
    const newAssembly = session.addAssemblyConf({
      name: genomeName,
      sequence: {
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation,
          chromSizesLocation,
        },
      },
    })
    assemblies.set(genomeName, newAssembly)
  }
  return assemblies
}
