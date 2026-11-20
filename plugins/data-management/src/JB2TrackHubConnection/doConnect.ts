import { getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession, isUriLocation } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { openLocation } from '@jbrowse/core/util/io'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { resolve } from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { JB2TrackHubConnectionConfigModel } from './configSchema.ts'

type HubAssembly = Record<string, unknown> & { name: string }

type HubTrack = Record<string, unknown> & { assemblyNames?: string[] }

type HubConfig = Record<string, unknown> & {
  assemblies?: HubAssembly[]
  tracks?: HubTrack[]
}

// lazyConnect wraps this in the shared connect-failure handler
export async function doConnect(
  self: ConnectionDoConnectArg<JB2TrackHubConnectionConfigModel>,
) {
  const session = getSession(self)
  const { pluginManager } = getEnv(self)
  const configJsonLocation = getConf(self, 'configJsonLocation')
  const assemblyNames = getConf(self, 'assemblyNames')
  if (!isUriLocation(configJsonLocation)) {
    throw new Error(
      'a JBrowse 2 connection resolves its tracks against the config.json URL, so its configJsonLocation takes a { "uri" } location',
    )
  }

  const configJson: HubConfig = JSON.parse(
    await openLocation(configJsonLocation, pluginManager).readFile('utf8'),
  )
  if (isAlive(self)) {
    const configUri = resolve(
      configJsonLocation.uri,
      configJsonLocation.baseUri,
    )
    addRelativeUris(configJson, new URL(configUri))
    const wanted = (name: string) =>
      assemblyNames.length === 0 || assemblyNames.includes(name)
    for (const assembly of configJson.assemblies ?? []) {
      if (
        wanted(assembly.name) &&
        !session.assemblyManager.has(assembly.name)
      ) {
        session.addSessionAssembly?.(assembly)
      }
    }

    const imported = ({ assemblyNames: names = [] }: HubTrack) =>
      names.some(wanted) &&
      names.every(name => wanted(name) || session.assemblyManager.has(name))
    const tracks = configJson.tracks ?? []
    self.addTrackConfs(
      assemblyNames.length === 0 ? tracks : tracks.filter(imported),
    )
    if (!self.silent) {
      session.notify('Successfully loaded', 'success')
    }
  }
}
