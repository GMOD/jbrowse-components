import { getConf } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { resolve } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'
import { addRelativeUris } from './addRelativeUris'

export async function doConnect(self: {
  configuration: AnyConfigurationModel
  addTrackConfs: (arg: Record<string, unknown>[]) => void
}) {
  const { pluginManager } = getEnv(self)
  const session = getSession(self)
  const notLoadedAssemblies = [] as string[]
  try {
    const configJsonLocation = getConf(
      self,
      'configJsonLocation',
    ) as FileLocation

    const configJson = JSON.parse(
      await openLocation(configJsonLocation).readFile('utf8'),
    )
    const configUri = resolve(
      // @ts-expect-error
      configJsonLocation.uri,
      // @ts-expect-error
      configJsonLocation.baseUri,
    )
    console.log({ configUri })
    addRelativeUris(configJson, new URL(configUri))
    const { assemblyManager } = session
    configJson.assemblies.forEach((a: { name: string }) => {
      const asm = assemblyManager.get(a.name)
      if (!asm) {
        // @ts-expect-error
        session.addSessionAssembly(asm)
      }
    })

    self.addTrackConfs(configJson.tracks)
    session.notify('Successfully loaded', 'success')
  } catch (e) {
    console.error(e)
    session.notifyError(`${getConf(self, 'name')}: "${e}"`, e)
    session.breakConnection?.(self.configuration)
  }
}
