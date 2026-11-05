import { getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession, isUriLocation } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { openLocation } from '@jbrowse/core/util/io'

import { resolve } from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { JB2TrackHubConnectionConfigModel } from './configSchema.ts'

// lazyConnect wraps this in the shared connect-failure handler
export async function doConnect(
  self: ConnectionDoConnectArg<JB2TrackHubConnectionConfigModel>,
) {
  const session = getSession(self)
  const { pluginManager } = getEnv(self)
  const configJsonLocation = getConf(self, 'configJsonLocation')
  if (!isUriLocation(configJsonLocation)) {
    throw new Error(
      'a JBrowse 2 connection resolves its tracks against the config.json URL, so its configJsonLocation takes a { "uri" } location',
    )
  }

  const configJson = JSON.parse(
    await openLocation(configJsonLocation, pluginManager).readFile('utf8'),
  )
  const configUri = resolve(configJsonLocation.uri, configJsonLocation.baseUri)
  addRelativeUris(configJson, new URL(configUri))
  if (configJson.assemblies) {
    for (const assembly of configJson.assemblies) {
      if (!session.assemblyManager.has(assembly.name)) {
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
}
