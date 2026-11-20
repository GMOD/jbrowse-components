import { getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession, isUriLocation } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { openLocation } from '@jbrowse/core/util/io'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { resolve } from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { JB2TrackHubConnectionConfigModel } from './configSchema.ts'

type HubAssembly = Record<string, unknown> & {
  name: string
  aliases?: string[]
}

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
    const everyGenome = assemblyNames.length === 0
    const isListed = (name: string) =>
      assemblyNames.some(listed =>
        isSameAssemblyName(listed, name, session.assemblyManager),
      )
    const listedAssemblies = (configJson.assemblies ?? []).filter(
      ({ name, aliases = [] }) =>
        everyGenome || [name, ...aliases].some(isListed),
    )
    for (const assembly of listedAssemblies) {
      if (!session.assemblyManager.has(assembly.name)) {
        session.addSessionAssembly?.(assembly)
      }
    }

    const listedNames = new Set(
      listedAssemblies.flatMap(({ name, aliases = [] }) => [name, ...aliases]),
    )
    const tracks = (configJson.tracks ?? []).filter(
      track =>
        everyGenome ||
        track.assemblyNames?.some(
          name => listedNames.has(name) || isListed(name),
        ),
    )
    if (listedAssemblies.length === 0 && tracks.length === 0 && !everyGenome) {
      throw new Error(
        `none of this hub's genomes is named ${assemblyNames.join(', ')}, as assemblyNames asks`,
      )
    }
    self.addTrackConfs(tracks)
    if (!self.silent) {
      session.notify('Successfully loaded', 'success')
    }
  }
}
