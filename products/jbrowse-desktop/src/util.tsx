import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { LoadedPlugin } from '@jbrowse/core/PluginLoader'

/**
 * A filename for the fetched plugin. The temp directory below is created fresh
 * for this one file, so the name carries no identity — it only has to be a
 * valid filename, and to read well in the stack traces the plugin will produce.
 * Its own basename is both, and better than what `sanitize-filename` gave:
 * that stripped the separators out of the whole url, so
 * https://example.com/plugin.js was written as httpsexample.complugin.js.
 *
 * Whatever the url is, the result is one path segment: an allowlist strips the
 * separators an encoded url can still be carrying, and it has to hold a word
 * character rather than merely be non-empty, which is what turns `.` and `..`
 * into the fallback instead of a name that walks out of the directory.
 */
export function pluginFileName(url: string) {
  const pathname = url.replace(/[?#].*$/, '')
  // `basename` ignores a trailing slash, so without this a url that names a
  // directory is written under the host name it ends with
  const basename = pathname.endsWith('/') ? '' : path.posix.basename(pathname)
  const cleaned = basename.replaceAll(/[^\w.-]/g, '').slice(0, 200)
  return /\w/.test(cleaned) ? cleaned : 'plugin.js'
}

export async function fetchCJS(url: string): Promise<LoadedPlugin> {
  // On macOS `os.tmpdir()` returns the path to a symlink, see:
  // https://github.com/nodejs/node/issues/11422
  const tmpDir = await fsPromises.mkdtemp(
    path.join(await fsPromises.realpath(os.tmpdir()), 'jbrowse-plugin-'),
  )
  try {
    const pluginLocation = path.join(tmpDir, pluginFileName(url))
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
