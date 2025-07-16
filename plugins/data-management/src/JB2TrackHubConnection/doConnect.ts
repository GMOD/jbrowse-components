import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { addRelativeUris } from './addRelativeUris'
import { resolve } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'

export async function doConnect(self: {
  configuration: AnyConfigurationModel
  addTrackConfs: (arg: Record<string, unknown>[]) => void
}) {
  const session = getSession(self)
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
      configJsonLocation.baseUri || 'http://localhost:3000/test_data/volvox/',
    )
    console.log('WOWOWOWOW', { configJsonLocation, configUri })
    addRelativeUris(configJson, new URL(configUri))
    if (configJson.assemblies) {
      for (const assembly of configJson.assemblies) {
        if (!session.assemblyManager.get(assembly.name)) {
          // @ts-expect-error
          session.addSessionAssembly(assembly)
        }
      }
    }

    if (configJson.tracks) {
      self.addTrackConfs(configJson.tracks)
    }
    session.notify('Successfully loaded', 'success')
  } catch (e) {
    console.error(e)
    session.notifyError(`${getConf(self, 'name')}: "${e}"`, e)
    session.breakConnection?.(self.configuration)
  }
}
