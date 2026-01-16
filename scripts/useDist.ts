import fs from 'fs'
import path from 'path'

const root = path.resolve(import.meta.dirname, '..')

interface PackageJson {
  name: string
  main?: string
  types?: string
  exports?: Record<string, unknown>
  publishConfig?: {
    main?: string
    types?: string
    exports?: Record<string, unknown>
  }
  _originalMain?: string
  _originalTypes?: string
  _originalExports?: Record<string, unknown>
  [key: string]: unknown
}

function main() {
  const workspaceDirs = ['packages', 'products', 'plugins']

  for (const dir of workspaceDirs) {
    const fullDir = path.join(root, dir)
    if (fs.existsSync(fullDir)) {
      for (const subdir of fs.readdirSync(fullDir)) {
        const pkgJsonPath = path.join(fullDir, subdir, 'package.json')
        if (fs.existsSync(pkgJsonPath)) {
          switchToDist(pkgJsonPath)
        }
      }
    }
  }

  console.log('Switched all packages to use dist exports')
}

function switchToDist(pkgJsonPath: string) {
  const content = fs.readFileSync(pkgJsonPath, 'utf8')
  const pkgJson: PackageJson = JSON.parse(content)
  const { publishConfig } = pkgJson

  if (!publishConfig?.exports && !publishConfig?.main) {
    return
  }

  let modified = false

  // Store originals if not already stored
  if (publishConfig?.main && pkgJson.main !== publishConfig.main) {
    pkgJson._originalMain = pkgJson.main
    pkgJson.main = publishConfig.main
    modified = true
  }
  if (publishConfig?.types && pkgJson.types !== publishConfig.types) {
    pkgJson._originalTypes = pkgJson.types
    pkgJson.types = publishConfig.types
    modified = true
  }
  if (publishConfig?.exports && pkgJson.exports !== publishConfig.exports) {
    pkgJson._originalExports = pkgJson.exports
    pkgJson.exports = publishConfig.exports
    modified = true
  }

  if (modified) {
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n')
    console.log(`  ${pkgJson.name}: switched to dist`)
  }
}

main()
