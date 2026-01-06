import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { glob } from 'glob'

// Find all build configs
const buildConfigs = await glob('{packages,plugins,products}/*/tsconfig.build.esm.json', {
  ignore: ['**/node_modules/**'],
})

for (const configPath of buildConfigs) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  let modified = false

  // Remove project reference settings
  if (config.compilerOptions) {
    if ('composite' in config.compilerOptions) {
      delete config.compilerOptions.composite
      modified = true
    }
    if ('declarationMap' in config.compilerOptions) {
      delete config.compilerOptions.declarationMap
      modified = true
    }
  }

  if (config.references) {
    delete config.references
    modified = true
  }

  if (modified) {
    console.log(`Cleaning ${configPath}`)
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
  }
}

// Remove root tsconfig.build.json
if (existsSync('tsconfig.build.json')) {
  console.log('Removing tsconfig.build.json')
  unlinkSync('tsconfig.build.json')
}

console.log('Done!')
