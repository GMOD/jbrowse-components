import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

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
    const response = await fetch(url, { cache: 'no-cache' })
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} when fetching plugin: ${url}`,
      )
    }
    const pluginText = await response.text()
    await fsPromises.writeFile(pluginLocation, pluginText)
    // The absolute path, not `path.relative('.', pluginLocation)`. A relative
    // request is resolved by require() against the *requiring module's*
    // directory, while path.relative measures from `process.cwd()` — so the two
    // agree only when the app was started from its own directory. A packaged
    // app is never launched that way: cwd is the install dir (or `/` from macOS
    // Finder) while the page's module dir is inside app.asar, and every CJS
    // plugin load failed MODULE_NOT_FOUND. An absolute request needs no base at
    // all — Module._findPath short-circuits on path.isAbsolute, on Windows
    // drive-letter paths included.
    return globalThis.require(pluginLocation) as LoadedPlugin
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true })
  }
}
