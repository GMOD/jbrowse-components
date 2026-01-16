import fs from 'fs'
import path from 'path'
import spawn from 'cross-spawn'

const root = path.resolve(import.meta.dirname, '..')

// Run build and capture stderr to find TS2742 errors
function runBuildAndCaptureErrors(): string[] {
  const result = spawn.sync('yarn', ['build'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  const output = (result.stdout || '') + (result.stderr || '')

  // Extract paths from TS2742 errors
  // Pattern: "cannot be named without a reference to '...node_modules/@jbrowse/PKG/esm/PATH'"
  const regex = /cannot be named without a reference to '[^']*node_modules\/(@jbrowse\/[^/]+)\/esm\/([^']+)'/g
  const missingExports: string[] = []

  let match
  while ((match = regex.exec(output)) !== null) {
    const pkg = match[1] // e.g., @jbrowse/core
    const exportPath = match[2] // e.g., assemblyManager/assemblyManager
    missingExports.push(`${pkg}:${exportPath}`)
  }

  return [...new Set(missingExports)] // dedupe
}

function getPackageJsonPath(pkgName: string): string | null {
  const workspaceDirs = ['packages', 'products', 'plugins']

  for (const dir of workspaceDirs) {
    const fullDir = path.join(root, dir)
    if (fs.existsSync(fullDir)) {
      for (const subdir of fs.readdirSync(fullDir)) {
        const pkgJsonPath = path.join(fullDir, subdir, 'package.json')
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
          if (pkgJson.name === pkgName) {
            return pkgJsonPath
          }
        }
      }
    }
  }
  return null
}

function addExportToPackage(pkgJsonPath: string, exportPath: string) {
  const content = fs.readFileSync(pkgJsonPath, 'utf8')
  const pkgJson = JSON.parse(content)

  // Remove .d.ts or .js extension to get the base path
  const basePath = exportPath.replace(/\.(d\.ts|js)$/, '')
  const exportKey = `./${basePath}`

  // Determine source extension by checking what exists
  const pkgDir = path.dirname(pkgJsonPath)
  let srcExt = '.ts'
  const possibleExts = ['.ts', '.tsx', '.js', '.jsx']
  for (const ext of possibleExts) {
    if (fs.existsSync(path.join(pkgDir, 'src', basePath + ext))) {
      srcExt = ext
      break
    }
  }

  // Add to exports (src version for dev)
  if (!pkgJson.exports) {
    pkgJson.exports = {}
  }
  if (!pkgJson.exports[exportKey]) {
    pkgJson.exports[exportKey] = `./src/${basePath}${srcExt}`
    console.log(`  Added export: ${exportKey} -> ./src/${basePath}${srcExt}`)
  }

  // Add to publishConfig.exports (esm version for build)
  if (pkgJson.publishConfig?.exports) {
    if (!pkgJson.publishConfig.exports[exportKey]) {
      pkgJson.publishConfig.exports[exportKey] = {
        types: `./esm/${basePath}.d.ts`,
        import: `./esm/${basePath}.js`,
      }
      console.log(`  Added publishConfig export: ${exportKey}`)
    }
  }

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n')
}

function main() {
  console.log('Running build to find missing exports...\n')

  const missingExports = runBuildAndCaptureErrors()

  if (missingExports.length === 0) {
    console.log('No missing exports found!')
    return
  }

  console.log(`\nFound ${missingExports.length} missing exports:\n`)

  for (const entry of missingExports) {
    const [pkgName, exportPath] = entry.split(':')
    console.log(`${pkgName}: ${exportPath}`)

    const pkgJsonPath = getPackageJsonPath(pkgName!)
    if (pkgJsonPath) {
      addExportToPackage(pkgJsonPath, exportPath!)
    } else {
      console.log(`  Warning: Could not find package.json for ${pkgName}`)
    }
  }

  console.log('\nDone! Run yarn build again to check for more missing exports.')
}

main()
