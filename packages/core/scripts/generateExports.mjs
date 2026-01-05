import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const srcDir = join(packageRoot, 'src')

// Read and parse list.ts to extract the array
const listContent = readFileSync(join(srcDir, 'ReExports/list.ts'), 'utf8')
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

// Check if a path is a directory with index file or a file
function getSourcePath(entry) {
  const relativePath = entry.slice(2) // remove leading ./
  const dirPath = join(srcDir, relativePath)

  // Check if it's a directory with index.ts or index.tsx
  if (existsSync(dirPath)) {
    if (existsSync(join(dirPath, 'index.ts'))) {
      return `/${relativePath}/index.ts`
    }
    if (existsSync(join(dirPath, 'index.tsx'))) {
      return `/${relativePath}/index.tsx`
    }
  }

  // Check for .ts, .tsx, or .js file
  if (existsSync(`${dirPath}.ts`)) {
    return `/${relativePath}.ts`
  }
  if (existsSync(`${dirPath}.tsx`)) {
    return `/${relativePath}.tsx`
  }
  if (existsSync(`${dirPath}.js`)) {
    return `/${relativePath}.js`
  }

  console.warn(`Warning: Could not find source file for ${entry}`)
  return `/${relativePath}.ts`
}

function getOutputPath(entry) {
  const relativePath = entry.slice(2) // remove leading ./
  const dirPath = join(srcDir, relativePath)

  // Check if it's a directory with index file
  if (existsSync(dirPath)) {
    if (existsSync(join(dirPath, 'index.ts')) || existsSync(join(dirPath, 'index.tsx'))) {
      return `/${relativePath}/index.js`
    }
  }

  // Default: assume it's a file
  return `/${relativePath}.js`
}

// Generate dev exports (pointing to src)
const devExports = {
  '.': {
    import: './src/index.ts',
    require: './src/index.ts',
  },
}

// Generate publish exports (pointing to esm/dist)
const publishExports = {
  '.': {
    types: './dist/index.d.ts',
    import: './esm/index.js',
    require: './dist/index.js',
  },
}

for (const entry of coreEntries) {
  const srcPath = getSourcePath(entry)
  const outPath = getOutputPath(entry)

  devExports[entry] = {
    import: `./src${srcPath}`,
    require: `./src${srcPath}`,
  }

  publishExports[entry] = {
    types: `./dist${outPath.replace('.js', '.d.ts')}`,
    import: `./esm${outPath}`,
    require: `./dist${outPath}`,
  }
}

// Read package.json
const packageJsonPath = join(packageRoot, 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

// Update exports for dev time
packageJson.exports = devExports

// Update publishConfig exports for publish time
if (!packageJson.publishConfig) {
  packageJson.publishConfig = {}
}
packageJson.publishConfig.exports = publishExports

// Write back
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

console.log(`Generated ${Object.keys(devExports).length} dev export entries`)
console.log(`Generated ${Object.keys(publishExports).length} publish export entries`)
