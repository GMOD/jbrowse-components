import fs from 'fs'
import path from 'path'

import { JBROWSE_PROTOCOL } from '../../electron/launchTarget.ts'
import {
  APP_ID,
  APP_NAME,
  ASSETS,
  BUILD,
  PRODUCT_NAME,
  ROOT,
  VERSION,
  packagedApp,
} from './config.ts'
import { macSessionDocumentType } from './sessionFileType.ts'
import { ensureDir, generateAppUpdateYml, log } from './utils.ts'

import type { Platform } from './config.ts'

export async function packageApp(target: Platform) {
  const app = packagedApp(target)
  const { platform, arch, name, dir } = app
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

  const outDir = path.dirname(dir)
  ensureDir(outDir)

  const icon =
    platform === 'win32'
      ? path.join(ASSETS, 'icon.ico')
      : platform === 'darwin'
        ? path.join(ASSETS, 'icon.icns')
        : undefined

  // `continueOnError` defaults to true, and packager reports the failure
  // through a `warning()` that `quiet` below suppresses — so a signing failure
  // (an expired identity, say) otherwise produces an unsigned app and no
  // message at all. entitlements and hardenedRuntime are per-file options in
  // @electron/osx-sign v2; passed at the top level they are silently ignored,
  // and the app is signed with osx-sign's defaults instead of entitlements.plist.
  const osxSign =
    platform === 'darwin' && process.env.APPLE_ID
      ? {
          identity: 'Developer ID Application',
          continueOnError: false,
          optionsForFile: () => ({
            hardenedRuntime: true,
            entitlements: path.join(ROOT, 'entitlements.plist'),
          }),
        }
      : undefined

  try {
    const appPaths = await packager({
      dir: BUILD,
      out: outDir,
      name,
      executableName: name,
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
    if (appPaths[0] !== dir) {
      throw new Error(
        `@electron/packager wrote ${appPaths[0]}, not the ${dir} the installers and the browser-test harness derive`,
      )
    }
    // The one file whose absence disables updates outright, and says nothing
    // about it: electron-updater reads process.resourcesPath/app-update.yml to
    // learn where to look, and without it every check throws ENOENT into an
    // error handler that is deliberately silent for the startup check. It rides
    // in on `extraResource`, which is packager's to honour and nothing else's to
    // notice — so this is asked here, where a build can still fail, rather than
    // discovered a release later.
    if (!fs.existsSync(path.join(app.resources, 'app-update.yml'))) {
      throw new Error(
        `app-update.yml is not in ${app.resources}: this build could not update itself`,
      )
    }
    return app
  } finally {
    fs.rmSync(pkgJsonPath, { force: true })
    fs.rmSync(appUpdateYmlPath, { force: true })
  }
}
