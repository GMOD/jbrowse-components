import fs from 'fs'
import path from 'path'

import { JBROWSE_PROTOCOL } from '../../electron/launchTarget.ts'
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
import { macSessionDocumentType } from './sessionFileType.ts'
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
      quiet: true,
      appCategoryType: 'public.app-category.science',
      extraResource: [appUpdateYmlPath],
      // Claims jbrowse:// links (a docs "open in Desktop" link). macOS only —
      // packager writes CFBundleURLTypes into Info.plist; Windows registers the
      // scheme from the NSIS installer and Linux from the .desktop file.
      protocols: [{ name: PRODUCT_NAME, schemes: [JBROWSE_PROTOCOL] }],
      // Claims the .jbrowse extension, so a saved session opens on double-click
      // in the Finder. The scheme above has a packager option of its own;
      // document types do not, so these go in as raw Info.plist keys. macOS
      // only — packager ignores extendInfo elsewhere, and the other two
      // platforms declare the same association in their own formats
      // (nsisScript.ts, and the mime package in linux.ts).
      extendInfo:
        platform === 'darwin'
          ? macSessionDocumentType(PRODUCT_NAME)
          : undefined,
      osxSign,
    })
    return appPaths[0]!
  } finally {
    fs.rmSync(pkgJsonPath, { force: true })
    fs.rmSync(appUpdateYmlPath, { force: true })
  }
}
