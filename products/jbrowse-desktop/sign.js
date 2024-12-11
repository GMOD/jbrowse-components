// this script adapted from
// https://github.com/electron-userland/electron-builder/issues/6158#issuecomment-899798533
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

const TEMP_DIR = path.join(__dirname, 'release', 'temp')

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

function sign(configuration) {
  console.log(`Signing ${configuration.path}`)
  // we move signed files to a file named tmp.exe because our product name
  // contains a space, meaning our .exe contains a space, which CodeSignTool
  // balks at even with attempted backslash escaping, so we rename to tmp.exe
  const tmpExe = `tmp-${Math.random()}.exe`

  // note: CodeSignTool can't sign in place without verifying the overwrite
  // with a y/m interaction so we are creating a new file in a temp directory
  // and then replacing the original file with the signed file.
  const signFile = [
    // code_signer is directory containing the CodeSignTool script in
    // products/jbrowse-desktop that is created by .github/workflows/release.sh
    // on windows
    'CODE_SIGN_TOOL_PATH=code_signer bash code_signer/CodeSignTool.sh sign',
    `-input_file_path='${tmpExe}'`,
    `-output_dir_path='${TEMP_DIR}'`,
    `-credential_id='${process.env.WINDOWS_SIGN_CREDENTIAL_ID}'`,
    `-username='${process.env.WINDOWS_SIGN_USER_NAME}'`,
    `-password='${process.env.WINDOWS_SIGN_USER_PASSWORD}'`,
    `-totp_secret='${process.env.WINDOWS_SIGN_USER_TOTP}'`,
  ].join(' ')
  const preMoveFile = `cp "${configuration.path}" "${tmpExe}"`
  const postMoveFile = `cp "${path.join(TEMP_DIR, tmpExe)}" "${configuration.path}"`
  childProcess.execSync(preMoveFile, {
    stdio: 'inherit',
  })
  childProcess.execSync(signFile, {
    stdio: 'inherit',
  })
  childProcess.execSync(postMoveFile, {
    stdio: 'inherit',
  })
}

exports.default = sign
