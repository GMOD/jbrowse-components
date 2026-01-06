import { readFileSync, writeFileSync, existsSync } from 'fs'
import { glob } from 'glob'
import { dirname, join } from 'path'

// Fix root tsconfig.build.json
const rootConfig = JSON.parse(readFileSync('tsconfig.build.json', 'utf8'))
rootConfig.references = rootConfig.references.map(ref => ({
  path: ref.path + '/tsconfig.build.esm.json'
}))
writeFileSync('tsconfig.build.json', JSON.stringify(rootConfig, null, 2) + '\n')
console.log('Fixed tsconfig.build.json')

// Fix all individual build configs
const buildConfigs = await glob('{packages,plugins,products}/*/tsconfig.build.esm.json', {
  ignore: ['**/node_modules/**'],
})

for (const configPath of buildConfigs) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'))

  if (config.references) {
    let modified = false
    config.references = config.references.map(ref => {
      if (!ref.path.endsWith('.json')) {
        modified = true
        return { path: ref.path + '/tsconfig.build.esm.json' }
      }
      return ref
    })

    if (modified) {
      console.log(`Fixed ${configPath}`)
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
    }
  }
}

console.log('Done!')
