import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import { APPLE_TEAM_ID, DIST, ROOT } from './config.ts'
import { ensureDir, log } from './utils.ts'

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

  const inputDir = path.join(DIST, '.sign-input')
  const outputDir = path.join(DIST, '.sign-output')
  ensureDir(inputDir)
  ensureDir(outputDir)

  // Use the original filename so the signed output has a predictable name
  const tmpExe = path.join(inputDir, path.basename(filePath))
  fs.copyFileSync(filePath, tmpExe)

  try {
    // Use spawnSync with an explicit args array to avoid shell injection —
    // credentials are passed as process arguments, not interpolated into a shell string
    const result = spawnSync(
      'bash',
      [
        'code_signer/CodeSignTool.sh',
        'sign',
        `-input_file_path=${tmpExe}`,
        `-output_dir_path=${outputDir}`,
        `-credential_id=${process.env.WINDOWS_SIGN_CREDENTIAL_ID}`,
        `-username=${process.env.WINDOWS_SIGN_USER_NAME}`,
        `-password=${process.env.WINDOWS_SIGN_USER_PASSWORD}`,
        `-totp_secret=${process.env.WINDOWS_SIGN_USER_TOTP}`,
      ],
      {
        stdio: 'inherit',
        cwd: ROOT,
        env: { ...process.env, CODE_SIGN_TOOL_PATH: 'code_signer' },
      },
    )

    if (result.status !== 0) {
      throw new Error(`CodeSignTool exited with status ${result.status}`)
    }

    fs.copyFileSync(path.join(outputDir, path.basename(tmpExe)), filePath)
  } finally {
    fs.rmSync(inputDir, { recursive: true, force: true })
    fs.rmSync(outputDir, { recursive: true, force: true })
  }

  log(`Signed: ${path.basename(filePath)}`)
}
