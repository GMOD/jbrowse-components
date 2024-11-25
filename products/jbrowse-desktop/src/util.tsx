import fsPromises from 'fs/promises'
import os from 'os'
import path from 'path'

import sanitize from 'sanitize-filename'
import type { LoadedPlugin } from '@jbrowse/core/PluginLoader'

export async function fetchCJS(url: string): Promise<LoadedPlugin> {
  // On macOS `os.tmpdir()` returns the path to a symlink, see:
  // https://github.com/nodejs/node/issues/11422
  const tmpDir = await fsPromises.mkdtemp(
    path.join(await fsPromises.realpath(os.tmpdir()), 'jbrowse-plugin-'),
  )
  try {
    const pluginLocation = path.join(tmpDir, sanitize(url))
    const pluginLocationRelative = path.relative('.', pluginLocation)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} when fetching plugin: ${url})`,
      )
    }
    const pluginText = await response.text()
    await fsPromises.writeFile(pluginLocation, pluginText)
    return globalThis.require(pluginLocationRelative) as LoadedPlugin
  } finally {
    await fsPromises.rmdir(tmpDir, { recursive: true })
  }
}
