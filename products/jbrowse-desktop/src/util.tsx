import { LoadedPlugin } from '@jbrowse/core/PluginLoader'
import sanitize from 'sanitize-filename'

export async function fetchCJS(url: string): Promise<LoadedPlugin> {
  const fs: typeof import('fs') = window.require('fs')
  const path: typeof import('path') = window.require('path')
  const os: typeof import('os') = window.require('os')
  const http: typeof import('http') = window.require('http')
  const fsPromises = fs.promises
  // On macOS `os.tmpdir()` returns the path to a symlink, see:
  // https://github.com/nodejs/node/issues/11422
  const tmpDir = await fsPromises.mkdtemp(
    path.join(await fsPromises.realpath(os.tmpdir()), 'jbrowse-plugin-'),
  )
  try {
    const pluginLocation = path.join(tmpDir, sanitize(url))
    const pluginLocationRelative = path.relative('.', pluginLocation)

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(pluginLocation)
      http
        .get(url, res => {
          res.pipe(file)
          file.on('finish', resolve)
        })
        .on('error', err => {
          fs.unlinkSync(pluginLocation)
          reject(err)
        })
    })
    return window.require(pluginLocationRelative) as LoadedPlugin
  } finally {
    await fsPromises.rmdir(tmpDir, { recursive: true })
  }
}
