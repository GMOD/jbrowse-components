import fs from 'fs'
import path from 'path'

import { APP_ID, APPLE_TEAM_ID, DIST } from './config.ts'
import { ensureDir, log, run } from './utils.ts'

export async function signMacApp(appPath: string) {
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    log('Skipping macOS code signing (APPLE_ID not set)')
    return
  }

  log('Signing macOS app...')
  run(
    `codesign --deep --force --options runtime --sign "Developer ID Application" "${appPath}"`,
  )
  log('macOS app signed')
}

export async function notarizeMacApp(appPath: string) {
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    log('Skipping macOS notarization (APPLE_ID not set)')
    return
  }

  if (!process.env.GITHUB_ACTIONS) {
    log('Skipping macOS notarization (not in CI)')
    return
  }

  log('Notarizing macOS app...')

  const { notarize } = await import('@electron/notarize')

  await notarize({
    tool: 'notarytool',
    teamId: APPLE_TEAM_ID,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
  })

  log('macOS app notarized')
}

export function signWindowsFile(filePath: string) {
  if (!process.env.WINDOWS_SIGN_CREDENTIAL_ID) {
    log(`Skipping Windows code signing for ${path.basename(filePath)}`)
    return
  }

  log(`Signing ${path.basename(filePath)}...`)

  const tempDir = path.join(DIST, '.sign-temp')
  ensureDir(tempDir)

  const tmpExe = path.join(tempDir, `tmp-${Date.now()}.exe`)
  fs.copyFileSync(filePath, tmpExe)

  const signCmd = [
    'CODE_SIGN_TOOL_PATH=code_signer bash code_signer/CodeSignTool.sh sign',
    `-input_file_path='${tmpExe}'`,
    `-output_dir_path='${tempDir}'`,
    `-credential_id='${process.env.WINDOWS_SIGN_CREDENTIAL_ID}'`,
    `-username='${process.env.WINDOWS_SIGN_USER_NAME}'`,
    `-password='${process.env.WINDOWS_SIGN_USER_PASSWORD}'`,
    `-totp_secret='${process.env.WINDOWS_SIGN_USER_TOTP}'`,
  ].join(' ')

  run(signCmd)

  fs.copyFileSync(path.join(tempDir, path.basename(tmpExe)), filePath)
  fs.rmSync(tempDir, { recursive: true, force: true })

  log(`Signed: ${path.basename(filePath)}`)
}
