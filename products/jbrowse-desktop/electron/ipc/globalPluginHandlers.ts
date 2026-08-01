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
    return JSON.parse(
      await fs.promises.readFile(paths.globalPluginsPath, ENCODING),
    ) as unknown[]
  })

  ipcHandle('setGlobalPlugins', async (_event, plugins) => {
    await writeGlobalPlugins(paths, plugins)
  })
}
