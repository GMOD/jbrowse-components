import fs from 'fs'
import path from 'path'

import {
  APP_ID,
  APP_NAME,
  ASSETS,
  BUILD,
  DIST,
  PRODUCT_NAME,
  ROOT,
  VERSION,
} from './config.js'
import { ensureDir, generateAppUpdateYml, log } from './utils.js'

export async function packageApp(platform, arch) {
  log(`Packaging for ${platform}-${arch}...`)

  const packager = (await import('@electron/packager')).default

  // Create minimal package.json for packaged app
  const appPkg = {
    name: APP_NAME,
    version: VERSION,
    main: 'electron.js',
    type: 'module',
  }
  fs.writeFileSync(
    path.join(BUILD, 'package.json'),
    JSON.stringify(appPkg, null, 2),
  )

  // Write app-update.yml for electron-updater
  fs.writeFileSync(path.join(BUILD, 'app-update.yml'), generateAppUpdateYml())

  const outDir = path.join(DIST, 'unpacked')
  ensureDir(outDir)

  const icon =
    platform === 'win32'
      ? path.join(ASSETS, 'icon.ico')
      : platform === 'darwin'
        ? path.join(ASSETS, 'icon.icns')
        : undefined

  const opts = {
    dir: BUILD,
    out: outDir,
    name: APP_NAME,
    executableName: APP_NAME,
    platform,
    arch,
    appVersion: VERSION,
    appBundleId: APP_ID,
    icon,
    overwrite: true,
    asar: true,
    prune: false,
    appCategoryType: 'public.app-category.science',
  }

  // macOS signing during packaging
  if (platform === 'darwin' && process.env.APPLE_ID) {
    opts.osxSign = {
      identity: 'Developer ID Application',
      hardenedRuntime: true,
      entitlements: path.join(ROOT, 'entitlements.plist'),
      'entitlements-inherit': path.join(ROOT, 'entitlements.plist'),
    }
  }

  const appPaths = await packager(opts)

  // Cleanup temp files
  fs.unlinkSync(path.join(BUILD, 'package.json'))
  fs.unlinkSync(path.join(BUILD, 'app-update.yml'))

  return appPaths[0]
}
