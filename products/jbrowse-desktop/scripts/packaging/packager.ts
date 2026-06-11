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
} from './config.ts'
import { ensureDir, generateAppUpdateYml, log } from './utils.ts'

export async function packageApp(
  platform: 'darwin' | 'linux' | 'win32',
  arch: 'x64' | 'arm64' | 'universal',
) {
  log(`Packaging for ${platform}-${arch}...`)

  const { packager } = await import('@electron/packager')

  // Create minimal package.json for packaged app
  const appPkg = {
    name: APP_NAME,
    productName: PRODUCT_NAME,
    version: VERSION,
    main: 'electron.js',
    type: 'module',
  }

  const pkgJsonPath = path.join(BUILD, 'package.json')
  const appUpdateYmlPath = path.join(BUILD, 'app-update.yml')

  fs.writeFileSync(pkgJsonPath, JSON.stringify(appPkg, null, 2))
  fs.writeFileSync(appUpdateYmlPath, generateAppUpdateYml())

  const outDir = path.join(DIST, 'unpacked')
  ensureDir(outDir)

  const icon =
    platform === 'win32'
      ? path.join(ASSETS, 'icon.ico')
      : platform === 'darwin'
        ? path.join(ASSETS, 'icon.icns')
        : undefined

  const osxSign =
    platform === 'darwin' && process.env.APPLE_ID
      ? {
          identity: 'Developer ID Application',
          hardenedRuntime: true,
          entitlements: path.join(ROOT, 'entitlements.plist'),
          'entitlements-inherit': path.join(ROOT, 'entitlements.plist'),
        }
      : undefined

  try {
    const appPaths = await packager({
      dir: BUILD,
      out: outDir,
      name: platform === 'darwin' ? PRODUCT_NAME : APP_NAME,
      executableName: platform === 'darwin' ? PRODUCT_NAME : APP_NAME,
      platform,
      arch,
      appVersion: VERSION,
      appBundleId: APP_ID,
      icon,
      overwrite: true,
      asar: true,
      prune: false,
      appCategoryType: 'public.app-category.science',
      extraResource: [appUpdateYmlPath],
      osxSign,
    })
    return appPaths[0]!
  } finally {
    fs.rmSync(pkgJsonPath, { force: true })
    fs.rmSync(appUpdateYmlPath, { force: true })
  }
}
