import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const repoRoot = join(packageRoot, '../..')
const srcDir = join(packageRoot, 'src')

// Exports to keep even if not used internally (for backwards compatibility)
const preservedExports = ['@jbrowse/core/util/nanoid']

// Scan the codebase for all @jbrowse/core imports
function findAllImports() {
  try {
    // Find static imports: from '@jbrowse/core/...'
    const staticImports = execSync(
      `grep -roh "from '@jbrowse/core[^']*'" packages plugins products --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | sed "s/from '//;s/'$//" | sort -u`,
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)

    // Find dynamic imports: import('@jbrowse/core/...')
    const dynamicImports = execSync(
      `grep -roh "import('@jbrowse/core[^']*')" packages plugins products --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | sed "s/import('//;s/')$//" | sort -u`,
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)

    const allImports = [...new Set([...staticImports, ...dynamicImports])]
    return allImports.filter(i => i.startsWith('@jbrowse/core'))
  } catch (e) {
    console.error('Error scanning for imports:', e.message)
    return []
  }
}

// Check if a path is a directory with index file or a file
function getSourcePath(entry) {
  const relativePath = entry.replace('@jbrowse/core/', '')
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
  const relativePath = entry.replace('@jbrowse/core/', '')
  const dirPath = join(srcDir, relativePath)

  // Check if it's a directory with index file
  if (existsSync(dirPath)) {
    if (
      existsSync(join(dirPath, 'index.ts')) ||
      existsSync(join(dirPath, 'index.tsx'))
    ) {
      return `/${relativePath}/index.js`
    }
  }

  // Default: assume it's a file
  return `/${relativePath}.js`
}

// Find all imports and add preserved exports
const imports = [...new Set([...findAllImports(), ...preservedExports])]
console.log(`Found ${imports.length} unique @jbrowse/core import paths`)

// Generate dev exports (pointing to src)
// Using simple string format since import/require point to same .ts file
const devExports = {
  '.': './src/index.ts',
}

// Generate publish exports (pointing to esm)
const publishExports = {
  '.': {
    types: './esm/index.d.ts',
    import: './esm/index.js',
  },
}

for (const entry of imports) {
  const exportPath = entry.replace('@jbrowse/core', '.')
  const srcPath = getSourcePath(entry)
  const outPath = getOutputPath(entry)

  devExports[exportPath] = `./src${srcPath}`

  publishExports[exportPath] = {
    types: `./esm${outPath.replace('.js', '.d.ts')}`,
    import: `./esm${outPath}`,
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
console.log(
  `Generated ${Object.keys(publishExports).length} publish export entries`,
)
