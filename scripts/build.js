const fs = require('fs')
const path = require('path')
const { DepGraph } = require('dependency-graph')
const spawn = require('cross-spawn')
const workspaceRoot = require('find-yarn-workspace-root')()

const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]

function main() {
  // Get packages in all workspaces
  const packages = getPackages()
  // Make a dependency graph of packages (includes peerDependencies)
  const graph = getDependencyGraph(packages)
  // Get the levels of the graph. Each level is a list of packages that can all
  // be build concurrently as long as the previous levels have been built
  const levels = getLevels(graph)
  levels.forEach(level => {
    const scopes = []
    level.forEach(package => {
      scopes.push('--scope', package)
    })
    const { signal, status } = spawn.sync(
      'yarn',
      ['lerna', 'run', 'build', ...scopes],
      { stdio: 'inherit' },
    )
    if (signal || (status !== null && status > 0)) {
      process.exit(status || 1)
    }
  })
}

function getPackages() {
  const workspacesInfoJson = spawn.sync(
    'yarn',
    ['--json', 'workspaces', 'info'],
    { encoding: 'utf8' },
  ).stdout
  const workspacesInfo = JSON.parse(workspacesInfoJson)
  return JSON.parse(workspacesInfo.data)
}

function getDependencyGraph(packages) {
  const graph = new DepGraph()
  Object.entries(packages).forEach(([packageName, packageInfo]) => {
    if (!graph.hasNode(packageName)) {
      graph.addNode(packageName)
    }
    const dependencies = []
    const packageJsonText = fs.readFileSync(
      path.join(workspaceRoot, packageInfo.location, 'package.json'),
    )
    const packageJson = JSON.parse(packageJsonText)
    DEPENDENCY_TYPES.forEach(dt => {
      if (packageJson[dt]) {
        Object.keys(packageJson[dt]).forEach(k => {
          if (!dependencies.includes(k) && packages[k]) {
            dependencies.push(k)
          }
        })
      }
    })
    dependencies.forEach(dep => {
      if (!graph.hasNode(dep)) {
        graph.addNode(dep)
      }
      graph.addDependency(packageName, dep)
    })
  })
  return graph
}

function getLevels(graph, levels = []) {
  const done = flattened(levels)
  const newLevel = []
  Object.keys(graph.nodes)
    .filter(n => !done.includes(n))
    .forEach(n => {
      const deps = graph.dependenciesOf(n)
      if (!done.includes(n) && deps.every(d => done.includes(d))) {
        newLevel.push(n)
      }
    })
  levels.push(newLevel)
  if (graph.size() !== done.length + newLevel.length) {
    getLevels(graph, levels)
  }
  return levels
}

/**
 * Returns a flattened version of an array. Can replace with
 * `array.prototype.flat` if only using node >=11
 */
function flattened(array) {
  return [].concat(...array)
}

main()
