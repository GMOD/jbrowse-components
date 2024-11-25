import fs from 'fs'
import path from 'path'
import spawn from 'cross-spawn'
import { DepGraph } from 'dependency-graph'
import workspaceRoot from 'find-yarn-workspace-root'

const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]
const subDirs = ['cgv', 'lgv', 'lgv-vite', 'react-app']
const root = workspaceRoot()!

function main() {
  const packages = getPackages()
  const graph = getDependencyGraph(packages)
  getLevels(graph).forEach(level => {
    const scopes = [] as string[]
    level.forEach(pkg => {
      scopes.push('--scope', pkg)
    })
    const { signal, status } = spawn.sync(
      'yarn',
      ['lerna', 'exec', 'yarn', 'pack', ...scopes],
      { stdio: 'inherit' },
    )
    if (signal || (status !== null && status > 0)) {
      process.exit(status || 1)
    }
  })
  subDirs.forEach(dir => {
    fs.mkdirSync(path.join('component_tests', dir, 'packed'), {
      recursive: true,
    })
  })

  Object.values(packages).forEach(packageInfo => {
    let { location } = packageInfo
    if (location === 'packages/core') {
      const files = fs.readdirSync(location)
      const tarball = files.find(fileName => fileName.endsWith('.tgz'))
      if (!tarball) {
        throw new Error('tarball not found')
      }
      fs.unlinkSync(path.join(location, tarball))
      location = path.join(location, 'dist')
      const { signal, status } = spawn.sync(
        'yarn',
        ['pack', '--ignore-scripts'],
        { stdio: 'inherit', cwd: location },
      )
      if (signal || (status !== null && status > 0)) {
        process.exit(status || 1)
      }
    }
    const files = fs.readdirSync(location)
    const tarball = files.find(fileName => fileName.endsWith('.tgz'))
    if (!tarball) {
      console.warn(`No tarball from ${location}`)
      return
    }
    const newTarballName = tarball.replace(/-v\d+\.\d+\.\d+/, '')
    subDirs.forEach(dir => {
      fs.copyFileSync(
        path.join(location, tarball),
        path.join('component_tests', dir, 'packed', newTarballName),
      )
    })

    fs.rmSync(path.join(location, tarball))
  })
}

function getPackages(): Record<string, { location: string }> {
  const workspacesInfoJson = spawn.sync(
    'yarn',
    ['--json', 'workspaces', 'info'],
    { encoding: 'utf8' },
  ).stdout
  const workspacesInfo = JSON.parse(workspacesInfoJson)
  return JSON.parse(workspacesInfo.data)
}

function getDependencyGraph(packages: Record<string, { location: string }>) {
  const graph = new DepGraph()
  Object.entries(packages).forEach(([packageName, packageInfo]) => {
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
  })
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
