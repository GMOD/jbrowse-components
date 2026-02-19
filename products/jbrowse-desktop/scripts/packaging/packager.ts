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

export async function packageApp(platform: string, arch: string) {
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
  fs.writeFileSync(
    path.join(BUILD, 'package.json'),
    JSON.stringify(appPkg, null, 2),
  )

  const outDir = path.join(DIST, 'unpacked')
  ensureDir(outDir)

  const icon =
    platform === 'win32'
      ? path.join(ASSETS, 'icon.ico')
      : platform === 'darwin'
        ? path.join(ASSETS, 'icon.icns')
        : undefined

  const appUpdateYmlPath = path.join(BUILD, 'app-update.yml')
  fs.writeFileSync(appUpdateYmlPath, generateAppUpdateYml())

  const opts: Record<string, unknown> = {
    dir: BUILD,
    out: outDir,
    name: platform === 'darwin' ? PRODUCT_NAME : APP_NAME,
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
    extraResource: [appUpdateYmlPath],
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

  const appPaths = await packager(
    opts as unknown as Parameters<typeof packager>[0],
  )

  // Cleanup temp files
  fs.unlinkSync(path.join(BUILD, 'package.json'))
  fs.unlinkSync(appUpdateYmlPath)

  return appPaths[0]!
}
