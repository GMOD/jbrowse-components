import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')

// Read and parse list.ts to extract the array
const listContent = readFileSync(join(packageRoot, 'ReExports/list.ts'), 'utf8')
const arrayMatch = /export default \[([\s\S]*?)\]/.exec(listContent)
if (!arrayMatch) {
  throw new Error('Could not parse list.ts')
}

// Extract strings from the array
const entries = arrayMatch[1]
  .split('\n')
  .map(line => (/'([^']+)'/.exec(line))?.[1])
  .filter(Boolean)

// Filter for @jbrowse/core entries and convert to export paths
const coreEntries = entries
  .filter(e => e.startsWith('@jbrowse/core/'))
  .map(e => e.replace('@jbrowse/core/', './'))

// Check if a path is a directory with index file
function getOutputPath(entry) {
  const relativePath = entry.slice(1) // remove leading .
  const dirPath = join(packageRoot, relativePath)

  // Check if it's a directory with index.ts or index.tsx
  if (existsSync(dirPath)) {
    if (existsSync(join(dirPath, 'index.ts')) || existsSync(join(dirPath, 'index.tsx'))) {
      return `${relativePath}/index.js`
    }
  }

  // Check for .ts or .tsx file
  if (existsSync(`${dirPath}.ts`) || existsSync(`${dirPath}.tsx`)) {
    return `${relativePath}.js`
  }

  // Default: assume it's a file
  return `${relativePath}.js`
}

// Generate exports object
const exports = {}
for (const entry of coreEntries) {
  const outputPath = getOutputPath(entry)
  exports[entry] = {
    import: `./esm${outputPath}`,
    require: `./dist${outputPath}`,
  }
}

// Read package.json
const packageJsonPath = join(packageRoot, 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

// Update exports
packageJson.exports = exports

// Write back
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)  }\n`)

console.log(`Generated ${Object.keys(exports).length} export entries`)
