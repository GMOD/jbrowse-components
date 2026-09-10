import fs from 'fs'
import { parseArgs } from 'node:util'
import path from 'path'

import { unpackedApp } from './artifacts.ts'

export type Platform = 'linux' | 'mac' | 'win'

export function parsePackagingArgs() {
  const { values } = parseArgs({
    options: {
      linux: { type: 'boolean' },
      mac: { type: 'boolean' },
      win: { type: 'boolean' },
      all: { type: 'boolean' },
      'no-installer': { type: 'boolean' },
      publish: { type: 'boolean' },
    },
  })
  const all: Platform[] = ['linux', 'mac', 'win']
  return {
    platforms: values.all ? all : all.filter(p => values[p]),
    noInstaller: Boolean(values['no-installer']),
    publish: Boolean(values.publish),
  }
}

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const DIST = path.join(ROOT, 'dist')
export const BUILD = path.join(ROOT, 'build')
export const ASSETS = path.join(ROOT, 'assets')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

export const VERSION = process.env.JBROWSE_VERSION || pkg.version
export const APP_NAME = 'jbrowse-desktop'
export const PRODUCT_NAME = 'JBrowse 2'
export const APP_ID = 'org.jbrowse2.app'
export const APPLE_TEAM_ID = '9KR53J86Q2'

// Where the update feed lives: releases of this repo.
export const GITHUB_OWNER = 'GMOD'
export const GITHUB_REPO = 'jbrowse-components'

// The CN of the ssl.com certificate signWindowsFile signs with, which
// app-update.yml carries so a client can check the installer it downloaded came
// from us — absent, NsisUpdater skips that check entirely. Not a secret: it is
// printed inside every signed exe we publish, and an unset environment variable
// would silently mean no check. verifyWindowsSignature reads it back out of
// what was just signed, so a reissue under another name fails the build rather
// than every user's next update. The current certificate runs to 2027-07-10.
export const WINDOWS_PUBLISHER_NAME = 'Evolutionary Software Foundation'

// Where a packaged target lands on disk, from `unpackedApp`'s naming rule.
export function packagedApp(target: Platform) {
  const app = unpackedApp(target, {
    appName: APP_NAME,
    productName: PRODUCT_NAME,
  })
  return {
    ...app,
    dir: path.join(DIST, app.dir),
    bundle: path.join(DIST, app.bundle),
    executable: path.join(DIST, app.executable),
    resources: path.join(DIST, app.resources),
  }
}
