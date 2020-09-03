/* eslint-disable no-console */
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
  if (!pkgJson.distMain) {
    console.log('package.json does not have "distMain" field')
    process.exit(3)
  }
}

function modifyPkgJson(pkgJson) {
  pkgJson.main = pkgJson.distMain
  fs.writeFileSync(
    './package.json',
    `${JSON.stringify(pkgJson, undefined, 2)}\n`,
  )
}

main()
