import fs from 'fs'
import path from 'path'

import spawn from 'cross-spawn'
import { DepGraph } from 'dependency-graph'

const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
] as const

const root = path.resolve(import.meta.dirname, '..')

interface PackageJson {
  name: string
  scripts?: Record<string, string>
  [key: string]: unknown
}

function main() {
  const packages = getPackages()
  const graph = getDependencyGraph(packages)
  const buildOrder = graph.overallOrder()

  // Switch all packages to use dist exports before building
  console.log('Switching packages to dist mode...')
  spawn.sync('node', ['--experimental-strip-types', 'scripts/useDist.ts'], {
    cwd: root,
    stdio: 'inherit',
  })

  let buildFailed = false

  try {
    for (const pkg of buildOrder) {
      const location = packages[pkg]?.location
      if (!location) {
        console.warn(`Warning: Package "${pkg}" not found in workspace`)
        continue
      }

      const pkgPath = path.join(root, location)
      const pkgJsonPath = path.join(pkgPath, 'package.json')
      const pkgJson: PackageJson = JSON.parse(
        fs.readFileSync(pkgJsonPath, 'utf8'),
      )

      // Skip packages without a build script
      if (!pkgJson.scripts?.build) {
        continue
      }

      console.log(`\nBuilding ${pkg}...`)
      const { signal, status } = spawn.sync('yarn', ['build'], {
        cwd: pkgPath,
        stdio: 'inherit',
      })

      if (signal || (status !== null && status > 0)) {
        console.error(`Failed to build ${pkg}`)
        buildFailed = true
        break
      }
    }

    if (!buildFailed) {
      console.log('\nBuild complete!')
    }
  } finally {
    // Restore packages to use src exports
    console.log('\nSwitching packages back to src mode...')
    spawn.sync('node', ['--experimental-strip-types', 'scripts/useSrc.ts'], {
      cwd: root,
      stdio: 'inherit',
    })
  }

  if (buildFailed) {
    process.exit(1)
  }
}

function getPackages(): Record<string, { location: string }> {
  const packages: Record<string, { location: string }> = {}
  const workspaceDirs = ['packages', 'products', 'plugins']

  for (const dir of workspaceDirs) {
    const fullDir = path.join(root, dir)
    if (fs.existsSync(fullDir)) {
      for (const subdir of fs.readdirSync(fullDir)) {
        const pkgJsonPath = path.join(fullDir, subdir, 'package.json')
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
          packages[pkgJson.name] = { location: path.join(dir, subdir) }
        }
      }
    }
  }
  return packages
}

function getDependencyGraph(packages: Record<string, { location: string }>) {
  const graph = new DepGraph<string>()
  const packageNames = new Set(Object.keys(packages))

  // Add all packages as nodes
  for (const name of packageNames) {
    graph.addNode(name)
  }

  // Add edges for dependencies
  for (const [name, { location }] of Object.entries(packages)) {
    const pkgJsonPath = path.join(root, location, 'package.json')
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))

    for (const depType of DEPENDENCY_TYPES) {
      const deps = pkgJson[depType]
      if (deps) {
        for (const dep of Object.keys(deps)) {
          // Only add edges for packages in our monorepo
          if (packageNames.has(dep)) {
            graph.addDependency(name, dep)
          }
        }
      }
    }
  }

  return graph
}

main()
