import path from 'path'

import { APPLE_TEAM_ID } from './config.ts'
import { log, run } from './utils.ts'

// Notarization needs Apple credentials and only runs in CI (the release
// machine holds the signing identity). Signing itself keys off APPLE_ID alone
// (see packager.ts osxSign), so a local `package:mac` produces a signed but
// un-notarized app.
export function macNotarizationEnabled() {
  return Boolean(
    process.env.APPLE_ID &&
    process.env.APPLE_ID_PASSWORD &&
    process.env.GITHUB_ACTIONS,
  )
}

// Fails the build if the identity did not take — a broken signature otherwise
// ships silently and only surfaces as a Gatekeeper error on the user's machine.
// Runs whenever signing was requested, before notarization.
export function verifyMacCodesign(appPath: string) {
  if (!process.env.APPLE_ID) {
    log('Skipping codesign verify (unsigned build)')
    return
  }
  log('Verifying code signature...')
  run(`codesign --verify --deep --strict --verbose=2 "${appPath}"`)
}

// notarytool accepts an .app (zipped internally), a .dmg, or a .pkg, so this
// covers both the app and the DMG. Returns whether notarization actually ran,
// so the caller only staples when there is a ticket to staple.
export async function notarizeMac(targetPath: string) {
  if (!macNotarizationEnabled()) {
    log(`Skipping notarization of ${path.basename(targetPath)} (not enabled)`)
    return false
  }

  log(`Notarizing ${path.basename(targetPath)}...`)

  const { notarize } = await import('@electron/notarize')

  await notarize({
    teamId: APPLE_TEAM_ID,
    appPath: targetPath,
    appleId: process.env.APPLE_ID!,
    appleIdPassword: process.env.APPLE_ID_PASSWORD!,
  })

  log(`Notarized ${path.basename(targetPath)}`)
  return true
}

// Staples the notarization ticket into the bundle so Gatekeeper validates it
// offline — without this the first launch has to reach Apple's notary service,
// which fails or hangs when the machine is offline. Must run after notarize and,
// for the app, before it is placed into the DMG/ZIP so those inherit the ticket.
export function stapleMac(targetPath: string) {
  log(`Stapling ${path.basename(targetPath)}...`)
  run(`xcrun stapler staple "${targetPath}"`)
  // Confirm the whole Gatekeeper assessment (signature + notarization) passes,
  // catching a stapled-but-rejected artifact before it is published.
  run(`spctl --assess --type exec --verbose=2 "${targetPath}"`)
}
