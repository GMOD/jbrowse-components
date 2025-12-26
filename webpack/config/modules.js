import fs from 'fs'
import path from 'path'

import { createRequire } from 'module'

import paths from './paths.js'

const require = createRequire(import.meta.url)

function getAdditionalModulePaths(options = {}) {
  const baseUrl = options.baseUrl
  if (!baseUrl) {
    return ''
  }

  const baseUrlResolved = path.resolve(paths.appPath, baseUrl)

  if (path.relative(paths.appNodeModules, baseUrlResolved) === '') {
    return null
  }

  if (path.relative(paths.appSrc, baseUrlResolved) === '') {
    return [paths.appSrc]
  }

  if (path.relative(paths.appPath, baseUrlResolved) === '') {
    return null
  }

  throw new Error("Your project's `baseUrl` can only be set to `src` or `node_modules`.")
}

function getModules() {
  const hasTsConfig = fs.existsSync(paths.appTsConfig)

  let config = {}
  if (hasTsConfig) {
    const ts = require('typescript')
    config = ts.readConfigFile(paths.appTsConfig, ts.sys.readFile).config
  }

  const options = config.compilerOptions || {}
  return {
    additionalModulePaths: getAdditionalModulePaths(options),
  }
}

export default getModules()
