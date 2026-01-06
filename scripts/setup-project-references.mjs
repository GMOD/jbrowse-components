import { readFileSync, writeFileSync, existsSync } from 'fs'
import { glob } from 'glob'
import { dirname, relative, join } from 'path'

// Find all packages with tsconfig.build.esm.json
const buildConfigs = await glob('{packages,plugins,products}/*/tsconfig.build.esm.json', {
  ignore: ['**/node_modules/**'],
})

// Build a map of package name -> directory path
const pkgNameToDir = {}
const pkgDirToName = {}

for (const configPath of buildConfigs) {
  const dir = dirname(configPath)
  const pkgJsonPath = join(dir, 'package.json')
  if (existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
    pkgNameToDir[pkgJson.name] = dir
    pkgDirToName[dir] = pkgJson.name
  }
}

// Also add packages that use symlinked configs
const allPkgJsons = await glob('{packages,plugins,products}/*/package.json', {
  ignore: ['**/node_modules/**'],
})

for (const pkgJsonPath of allPkgJsons) {
  const dir = dirname(pkgJsonPath)
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  if (!pkgNameToDir[pkgJson.name]) {
    pkgNameToDir[pkgJson.name] = dir
    pkgDirToName[dir] = pkgJson.name
  }
}

console.log('Found packages:', Object.keys(pkgNameToDir).length)

// Update each build config with references
for (const configPath of buildConfigs) {
  const dir = dirname(configPath)
  const pkgJsonPath = join(dir, 'package.json')

  if (!existsSync(pkgJsonPath)) continue

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  const config = JSON.parse(readFileSync(configPath, 'utf8'))

  // Get all @jbrowse dependencies
  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
    ...pkgJson.peerDependencies
  }

  const jbrowseDeps = Object.keys(allDeps || {})
    .filter(d => d.startsWith('@jbrowse/') && pkgNameToDir[d])

  // Build references array
  const references = []
  for (const dep of jbrowseDeps) {
    const depDir = pkgNameToDir[dep]
    const depConfigPath = join(depDir, 'tsconfig.build.esm.json')

    if (existsSync(depConfigPath)) {
      const relativePath = relative(dir, depDir)
      references.push({ path: relativePath })
    }
  }

  // Update config
  config.compilerOptions = config.compilerOptions || {}
  config.compilerOptions.composite = true
  config.compilerOptions.declarationMap = true

  if (references.length > 0) {
    config.references = references
  }

  console.log(`Updating ${configPath} with ${references.length} references`)
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
}

// Create root tsconfig.build.json with all project references
const rootReferences = []
for (const configPath of buildConfigs) {
  const dir = dirname(configPath)
  rootReferences.push({ path: dir })
}

// Sort for consistent output
rootReferences.sort((a, b) => a.path.localeCompare(b.path))

const rootBuildConfig = {
  files: [],
  references: rootReferences
}

writeFileSync('tsconfig.build.json', JSON.stringify(rootBuildConfig, null, 2) + '\n')
console.log(`Created tsconfig.build.json with ${rootReferences.length} references`)

console.log('Done!')
