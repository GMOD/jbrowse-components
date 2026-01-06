import fs from 'fs'
import path from 'path'

import spawn from 'cross-spawn'
import { DepGraph } from 'dependency-graph'

const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]
const subDirs = ['cgv-vite', 'lgv-vite', 'app-vite']
const root = path.resolve(import.meta.dirname, '..')

function main() {
  const packages = getPackages()
  const graph = getDependencyGraph(packages)
  for (const level of getLevels(graph)) {
    for (const pkg of level) {
      const location = packages[pkg]?.location
      if (!location) {
        console.warn(`Warning: Package "${pkg}" not found in workspace`)
        continue
      }
      const { signal, status } = spawn.sync('pnpm', ['pack'], {
        stdio: 'inherit',
        cwd: path.join(root, location),
      })
      if (signal || (status !== null && status > 0)) {
        process.exit(status || 1)
      }
    }
  }
  for (const dir of subDirs) {
    fs.mkdirSync(path.join('component_tests', dir, 'packed'), {
      recursive: true,
    })
  }

  for (const packageInfo of Object.values(packages)) {
    let { location } = packageInfo
    if (location === 'packages/core') {
      const files = fs.readdirSync(location)
      const tarball = files.find(fileName => fileName.endsWith('.tgz'))
      if (!tarball) {
        throw new Error('tarball not found')
      }
      fs.unlinkSync(path.join(location, tarball))
      location = path.join(location, 'dist')
      const { signal, status } = spawn.sync('pnpm', ['pack'], {
        stdio: 'inherit',
        cwd: location,
      })
      if (signal || (status !== null && status > 0)) {
        process.exit(status || 1)
      }
    }
    const files = fs.readdirSync(location)
    const tarball = files.find(fileName => fileName.endsWith('.tgz'))
    if (!tarball) {
      console.warn(`No tarball from ${location}`)
      continue
    }
    const newTarballName = tarball.replace(/-v\d+\.\d+\.\d+/, '')
    for (const dir of subDirs) {
      fs.copyFileSync(
        path.join(location, tarball),
        path.join('component_tests', dir, 'packed', newTarballName),
      )
    }

    fs.rmSync(path.join(location, tarball))
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
  const graph = new DepGraph()
  for (const [packageName, packageInfo] of Object.entries(packages)) {
    if (!graph.hasNode(packageName)) {
      graph.addNode(packageName)
    }
    const dependencies = [] as string[]
    const packageJsonText = fs.readFileSync(
      path.join(root, packageInfo.location, 'package.json'),
      'utf8',
    )
    const packageJson = JSON.parse(packageJsonText)
    for (const dt of DEPENDENCY_TYPES) {
      if (packageJson[dt]) {
        for (const k of Object.keys(packageJson[dt])) {
          if (!dependencies.includes(k) && packages[k]) {
            dependencies.push(k)
          }
        }
      }
    }
    for (const dep of dependencies) {
      if (!graph.hasNode(dep)) {
        graph.addNode(dep)
      }
      graph.addDependency(packageName, dep)
    }
  }
  return graph
}

// Get the levels of the graph. Each level is a list of packages that can all
// be build concurrently as long as the previous levels have been built
function getLevels(graph: DepGraph<unknown>, levels = [] as string[][]) {
  const done = levels.flat()
  const newLevel = [] as string[]
  // @ts-expect-error
  for (const n of [...graph.nodes.keys()].filter(n => !done.includes(n))) {
    const deps = graph.dependenciesOf(n)
    if (!done.includes(n) && deps.every(d => done.includes(d))) {
      newLevel.push(n)
    }
  }
  levels.push(newLevel)
  if (graph.size() !== done.length + newLevel.length) {
    getLevels(graph, levels)
  }
  return levels
}

main()
