import fs from 'fs'

import { ipcMain } from 'electron'

import type { AppPaths } from '../paths.ts'

const ENCODING = 'utf8'

export function registerGlobalPluginHandlers(paths: AppPaths) {
  ipcMain.handle('getGlobalPlugins', async () => {
    const data = await fs.promises.readFile(
      paths.globalPluginsPath,
      ENCODING,
    )
    return JSON.parse(data)
  })

  ipcMain.handle(
    'setGlobalPlugins',
    async (_event: unknown, plugins: unknown[]) => {
      await fs.promises.writeFile(
        paths.globalPluginsPath,
        JSON.stringify(plugins, null, 2),
        ENCODING,
      )
    },
  )
}
