const fs = require('fs')
const spawn = require('cross-spawn')
const path = require('path')
const { DepGraph } = require('dependency-graph')
const workspaceRoot = require('find-yarn-workspace-root')()

const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]

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
  const done = levels.flat()
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

module.exports = { getLevels, getDependencyGraph, getPackages }
