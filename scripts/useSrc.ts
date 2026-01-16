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
          switchToSrc(pkgJsonPath)
        }
      }
    }
  }

  console.log('Switched all packages to use src exports')
}

function switchToSrc(pkgJsonPath: string) {
  const content = fs.readFileSync(pkgJsonPath, 'utf8')
  const pkgJson: PackageJson = JSON.parse(content)

  let modified = false

  // Restore originals if they exist
  if (pkgJson._originalMain !== undefined) {
    pkgJson.main = pkgJson._originalMain
    delete pkgJson._originalMain
    modified = true
  }
  if (pkgJson._originalTypes !== undefined) {
    pkgJson.types = pkgJson._originalTypes
    delete pkgJson._originalTypes
    modified = true
  }
  if (pkgJson._originalExports !== undefined) {
    pkgJson.exports = pkgJson._originalExports
    delete pkgJson._originalExports
    modified = true
  }

  if (modified) {
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n')
    console.log(`  ${pkgJson.name}: switched to src`)
  }
}

main()
