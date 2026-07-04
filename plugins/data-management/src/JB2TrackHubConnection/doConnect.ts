import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { addRelativeUris } from '@jbrowse/product-core'

import { resolve } from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { UriLocation } from '@jbrowse/core/util'

export async function doConnect(self: ConnectionDoConnectArg) {
  const session = getSession(self)
  try {
    const configJsonLocation = getConf(
      self,
      'configJsonLocation',
    ) as UriLocation

    const configJson = JSON.parse(
      await openLocation(configJsonLocation).readFile('utf8'),
    )
    const configUri = resolve(
      configJsonLocation.uri,
      configJsonLocation.baseUri,
    )
    addRelativeUris(configJson, new URL(configUri))
    if (configJson.assemblies) {
      for (const assembly of configJson.assemblies) {
        if (!session.assemblyManager.get(assembly.name)) {
          session.addSessionAssembly?.(assembly)
        }
      }
    }

    if (configJson.tracks) {
      self.addTrackConfs(configJson.tracks)
    }
    if (!self.silent) {
      session.notify('Successfully loaded', 'success')
    }
  } catch (e) {
    console.error(e)
    session.notifyError(`${getConf(self, 'name')}: "${e}"`, e)
    session.breakConnection?.(self.configuration)
  }
}
