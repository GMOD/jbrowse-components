/**
 * Makes a package.json's "main" field match the "srcMain" field and "module"
 * field into an empty string.
 */

const fs = require('fs')

function main() {
  const pkgJson = readPkgJson()
  checkPkgJson(pkgJson)
  modifyPkgJson(pkgJson)
}

function readPkgJson() {
  let pkgJsonText
  try {
    pkgJsonText = fs.readFileSync('./package.json')
  } catch (error) {
    console.log('This script must be run from the package directory')
    process.exit(1)
  }
  let pkgJson
  try {
    pkgJson = JSON.parse(pkgJsonText)
  } catch (error) {
    console.log('Syntax error in package.json')
    process.exit(2)
  }
  return pkgJson
}

function checkPkgJson(pkgJson) {
  if (!pkgJson.srcMain) {
    console.log('package.json does not have "srcMain" field')
    process.exit(3)
  }
}

function modifyPkgJson(pkgJson) {
  pkgJson.main = pkgJson.srcMain
  if (pkgJson.module) {
    pkgJson.module = ''
  }
  fs.writeFileSync(
    './package.json',
    `${JSON.stringify(pkgJson, undefined, 2)}\n`,
  )
}

main()
