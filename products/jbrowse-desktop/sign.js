/* eslint-disable no-undef */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const TEMP_DIR = path.join(import.meta.dirname, 'release', 'temp')

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

export default function sign(configuration) {
  if (!process.env.WINDOWS_SIGN_CREDENTIAL_ID) {
    console.warn(`Skipping code signing for ${configuration.path}`)
    return
  }
  console.warn(`Signing ${configuration.path}`)

  const tmpExe = `tmp-${Math.random()}.exe`

  const signFile = [
    'CODE_SIGN_TOOL_PATH=code_signer bash code_signer/CodeSignTool.sh sign',
    `-input_file_path='${tmpExe}'`,
    `-output_dir_path='${TEMP_DIR}'`,
    `-credential_id='${process.env.WINDOWS_SIGN_CREDENTIAL_ID}'`,
    `-username='${process.env.WINDOWS_SIGN_USER_NAME}'`,
    `-password='${process.env.WINDOWS_SIGN_USER_PASSWORD}'`,
    `-totp_secret='${process.env.WINDOWS_SIGN_USER_TOTP}'`,
  ].join(' ')

  execSync(`cp "${configuration.path}" "${tmpExe}"`, { stdio: 'inherit' })
  execSync(signFile, { stdio: 'inherit' })
  execSync(`cp "${path.join(TEMP_DIR, tmpExe)}" "${configuration.path}"`, {
    stdio: 'inherit',
  })
}
