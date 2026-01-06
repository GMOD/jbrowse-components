import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const files = await glob('**/package.json', {
  ignore: ['**/node_modules/**', '**/dist/**', '**/esm/**'],
})

for (const file of files) {
  const content = JSON.parse(readFileSync(file, 'utf8'))
  let modified = false

  // Update scripts
  if (content.scripts) {
    if (content.scripts['build:commonjs']) {
      delete content.scripts['build:commonjs']
      modified = true
    }
    if (content.scripts.build === 'pnpm build:esm && pnpm build:commonjs') {
      content.scripts.build = 'pnpm build:esm'
      modified = true
    }
    if (content.scripts.clean?.includes('dist')) {
      content.scripts.clean = content.scripts.clean
        .replace('dist esm', 'esm')
        .replace('rimraf dist', 'rimraf')
      modified = true
    }
  }

  // Update files array
  if (content.files && content.files.includes('dist')) {
    content.files = content.files.filter(f => f !== 'dist')
    modified = true
  }

  // Update publishConfig
  if (content.publishConfig) {
    if (content.publishConfig.main?.startsWith('dist/')) {
      content.publishConfig.main = content.publishConfig.main.replace('dist/', 'esm/')
      modified = true
    }
    if (content.publishConfig.types?.startsWith('dist/')) {
      content.publishConfig.types = content.publishConfig.types.replace('dist/', 'esm/')
      modified = true
    }

    // Update exports in publishConfig
    if (content.publishConfig.exports) {
      for (const [key, value] of Object.entries(content.publishConfig.exports)) {
        if (typeof value === 'object') {
          // Remove require entry
          if (value.require) {
            delete value.require
            modified = true
          }
          // Update types to use esm
          if (value.types?.startsWith('./dist/')) {
            value.types = value.types.replace('./dist/', './esm/')
            modified = true
          }
        }
      }
    }
  }

  if (modified) {
    console.log(`Updating ${file}`)
    writeFileSync(file, JSON.stringify(content, null, 2) + '\n')
  }
}

console.log('Done!')
