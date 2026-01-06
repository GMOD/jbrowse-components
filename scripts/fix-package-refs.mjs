import { readFileSync, writeFileSync, existsSync } from 'fs'
import { glob } from 'glob'
import { dirname, relative, join } from 'path'

// Build a map of package name -> directory path
const pkgNameToDir = {}

const allPkgJsons = await glob('{packages,plugins,products}/*/package.json', {
  ignore: ['**/node_modules/**'],
})

for (const pkgJsonPath of allPkgJsons) {
  const dir = dirname(pkgJsonPath)
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  pkgNameToDir[pkgJson.name] = dir
}

// Find all package configs (not plugins, those are done)
const packageConfigs = await glob('packages/*/tsconfig.build.esm.json', {
  ignore: ['**/node_modules/**'],
})

for (const configPath of packageConfigs) {
  const dir = dirname(configPath)
  const pkgJsonPath = join(dir, 'package.json')

  if (!existsSync(pkgJsonPath)) continue

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  const config = JSON.parse(readFileSync(configPath, 'utf8'))

  // Get all @jbrowse dependencies (excluding non-local ones)
  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.peerDependencies
  }

  const jbrowseDeps = Object.keys(allDeps || {})
    .filter(d => d.startsWith('@jbrowse/') && pkgNameToDir[d])

  // Build references array
  const references = []
  for (const dep of jbrowseDeps) {
    const depDir = pkgNameToDir[dep]
    const relativePath = relative(dir, depDir)
    references.push({ path: relativePath + '/tsconfig.build.esm.json' })
  }

  // Update config
  config.compilerOptions = config.compilerOptions || {}
  config.compilerOptions.composite = true
  config.compilerOptions.declarationMap = true
  config.compilerOptions.paths = {}
  config.compilerOptions.baseUrl = '.'

  if (references.length > 0) {
    config.references = references
  } else {
    delete config.references
  }

  console.log(`Updating ${configPath} with ${references.length} references: ${jbrowseDeps.join(', ')}`)
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
}

console.log('Done!')
