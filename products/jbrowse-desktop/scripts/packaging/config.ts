import fs from 'fs'
import { parseArgs } from 'node:util'
import path from 'path'

import { unpackedApp } from './artifacts.ts'

export type Platform = 'linux' | 'mac' | 'win'

// How much of a platform's build to run. `all` is the whole thing, and is what
// a local build does; `app` stops at the unpacked tree, which is what the E2E
// and screenshot harnesses want.
//
// `installer` and `finalize` resume a Windows build that has been away being
// signed. SignPath signs an uploaded GitHub Actions artifact rather than a file
// on the runner, so release.yml packages, sends the app exe away, comes back
// for `installer` to wrap what returned, sends that away, and comes back for
// `finalize` to measure it into latest.yml.
const PHASES = ['all', 'app', 'installer', 'finalize'] as const
export type Phase = (typeof PHASES)[number]

function parsePhase(value: string | undefined): Phase {
  const phase = value === undefined ? 'all' : PHASES.find(p => p === value)
  if (!phase) {
    throw new Error(`--phase ${value} is not one of ${PHASES.join(', ')}`)
  }
  return phase
}

export function parsePackagingArgs() {
  const { values } = parseArgs({
    options: {
      linux: { type: 'boolean' },
      mac: { type: 'boolean' },
      win: { type: 'boolean' },
      all: { type: 'boolean' },
      phase: { type: 'string' },
      publish: { type: 'boolean' },
    },
  })
  const all: Platform[] = ['linux', 'mac', 'win']
  return {
    platforms: values.all ? all : all.filter(p => values[p]),
    phase: parsePhase(values.phase),
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

// The privacy policy the Windows installer shows, and the site its
// root-relative links resolve against. Read from the page the website
// publishes, rather than copied into this package, so the installer cannot
// disclose an older one than jbrowse.org does. privacyNotice.ts flattens it.
export const PRIVACY_POLICY_MD = path.resolve(
  ROOT,
  '../../website/src/pages/privacy.md',
)
export const JBROWSE_SITE_URL = 'https://jbrowse.org/jb2'
export const PRIVACY_POLICY_URL = `${JBROWSE_SITE_URL}/privacy/`

// The certificate CNs app-update.yml tells a client to accept on an installer
// it downloaded — absent, NsisUpdater skips that check entirely. Not a secret:
// each is printed inside every signed exe we publish. verifyWindowsSignature
// reads the CN back out of what was just signed, so a certificate under an
// unlisted name fails the build rather than every user's next update.
//
// A list because the publisher can change. NsisUpdater reads it out of the
// *installed* app's copy of app-update.yml, so a client only accepts a new
// publisher if the build it installed from already named it: a new name has to
// ship here, in a release signed under the old one, before anything is signed
// under it. SignPath Foundation owns the certificate the release signs with;
// the ssl.com name it replaces stays listed until no supported install predates
// the first build that named both.
export const WINDOWS_PUBLISHER_NAMES = [
  'SignPath Foundation',
  'Evolutionary Software Foundation',
]

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
