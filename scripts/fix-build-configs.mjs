import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const files = await glob('**/tsconfig.build.esm.json', {
  ignore: ['**/node_modules/**'],
})

for (const file of files) {
  const content = JSON.parse(readFileSync(file, 'utf8'))

  if (!content.compilerOptions) {
    content.compilerOptions = {}
  }

  // Add paths: {} and baseUrl if not present
  if (!content.compilerOptions.paths) {
    content.compilerOptions.paths = {}
    content.compilerOptions.baseUrl = '.'
    console.log(`Updating ${file}`)
    writeFileSync(file, JSON.stringify(content, null, 2) + '\n')
  }
}

// Also remove any remaining commonjs configs
const commonjsFiles = await glob('**/tsconfig.build.commonjs.json', {
  ignore: ['**/node_modules/**'],
})

for (const file of commonjsFiles) {
  const { unlinkSync } = await import('fs')
  console.log(`Removing ${file}`)
  unlinkSync(file)
}

console.log('Done!')
