import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
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

// Find all plugin symlinks
const pluginConfigs = await glob('plugins/*/tsconfig.build.esm.json', {
  ignore: ['**/node_modules/**'],
})

for (const configPath of pluginConfigs) {
  const dir = dirname(configPath)
  const pkgJsonPath = join(dir, 'package.json')

  if (!existsSync(pkgJsonPath)) continue

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))

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

  // Create new config
  const config = {
    extends: '../../tsconfig',
    exclude: ['src/**/*.test.ts*', 'src/**/*.test.js*'],
    include: ['src/**/*.ts*', 'src/**/*.js*'],
    compilerOptions: {
      outDir: 'esm',
      rootDir: 'src',
      paths: {},
      baseUrl: '.',
      composite: true,
      declarationMap: true
    }
  }

  if (references.length > 0) {
    config.references = references
  }

  // Remove symlink and write new file
  try {
    unlinkSync(configPath)
  } catch (e) {
    // Not a symlink or doesn't exist
  }

  console.log(`Creating ${configPath} with ${references.length} references`)
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
}

// Also remove the shared plugins/tsconfig.build.esm.json if it exists and isn't needed
const sharedConfig = 'plugins/tsconfig.build.esm.json'
if (existsSync(sharedConfig)) {
  console.log(`Removing shared config: ${sharedConfig}`)
  unlinkSync(sharedConfig)
}

console.log('Done!')
