import fs from 'node:fs'

import { ENCODING, stringify } from '../paths.ts'
import { ipcHandle } from './channels.ts'

import type { AppPaths } from '../paths.ts'

export async function writeGlobalPlugins(
  paths: AppPaths,
  plugins: unknown[] = [],
) {
  await fs.promises.writeFile(
    paths.globalPluginsPath,
    stringify(plugins),
    ENCODING,
  )
}

// Plugins the user installs for every session, kept outside any one config in
// globalPlugins.json. initializeFileSystem creates the file, so a read failure
// here is a real error and is surfaced rather than silently treated as empty.
export function registerGlobalPluginHandlers(paths: AppPaths) {
  ipcHandle('getGlobalPlugins', async () => {
    const parsed: unknown = JSON.parse(
      await fs.promises.readFile(paths.globalPluginsPath, ENCODING),
    )
    // A file that parses but isn't a list is as unusable as one that doesn't
    // parse, and worse to pass on: the renderer spreads this straight into a
    // plugin list, so a bare object reaches PluginLoader as a TypeError that
    // names neither the file nor what is wrong with it — and takes the session
    // open (or the start screen's manager) down with it. Fail here, naming the
    // file, so the global plugins dialog can offer to reset it.
    if (!Array.isArray(parsed)) {
      throw new Error(
        `${paths.globalPluginsPath} does not contain a list of plugins`,
      )
    }
    return parsed as unknown[]
  })

  ipcHandle('setGlobalPlugins', async (_event, plugins) => {
    await writeGlobalPlugins(paths, plugins)
  })
}
