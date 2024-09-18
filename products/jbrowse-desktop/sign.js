// this script taken from
// https://github.com/electron-userland/electron-builder/issues/6158#issuecomment-899798533
// see our shared google drive -> developer folder for more info on this
const path = require('path')
const fs = require('fs')
const childProcess = require('child_process')

const TEMP_DIR = path.join(__dirname, 'release', 'temp')

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

function sign(configuration) {
  console.log(`Signing ${configuration.path}`)
  const { name, dir } = path.parse(configuration.path)
  // CodeSignTool can't sign in place without verifying the overwrite with a
  // y/m interaction so we are creating a new file in a temp directory and
  // then replacing the original file with the signed file.
  const signFile = [
    'codesigner/CodeSignTool.sh sign',
    `-input_file_path="${configuration.path}"`,
    `-output_dir_path="${TEMP_DIR}"`,
    `-credential_id="${process.env.WINDOWS_SIGN_CREDENTIAL_ID}"`,
    `-username="${process.env.WINDOWS_SIGN_USER_NAME}"`,
    `-password="${process.env.WINDOWS_SIGN_USER_PASSWORD}"`,
    `-totp_secret="${process.env.WINDOWS_SIGN_USER_TOTP}"`,
  ].join(' ')

  const moveFile = `mv "${path.join(TEMP_DIR, name)}" "${dir}"`
  childProcess.execSync(`${setDir} && ${signFile} && ${moveFile}`, {
    stdio: 'inherit',
  })
}

exports.default = sign
