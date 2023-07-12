import fsPromises from 'fs/promises'
import path from 'path'
import os from 'os'

import { LoadedPlugin } from '@jbrowse/core/PluginLoader'
import sanitize from 'sanitize-filename'

export async function fetchCJS(url: string): Promise<LoadedPlugin> {
  // On macOS `os.tmpdir()` returns the path to a symlink, see:
  // https://github.com/nodejs/node/issues/11422
  const tmpDir = await fsPromises.mkdtemp(
    path.join(await fsPromises.realpath(os.tmpdir()), 'jbrowse-plugin-'),
  )
  try {
    const pluginLocation = path.join(tmpDir, sanitize(url))
    const pluginLocationRelative = path.relative('.', pluginLocation)

    let pluginText = ''
    try {
      const pluginResponse = await fetch(url)
      if (!pluginResponse.ok) {
        throw new Error('Bad response')
      }
      pluginText = await pluginResponse.text()
    } catch (error) {
      console.error(error)
      await fsPromises.unlink(pluginLocation)
      throw error
    }
    await fsPromises.writeFile(pluginLocation, pluginText)
    return globalThis.require(pluginLocationRelative) as LoadedPlugin
  } finally {
    await fsPromises.rmdir(tmpDir, { recursive: true })
  }
}
