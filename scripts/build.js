const fs = require('fs')
const path = require('path')
const spawn = require('cross-spawn')
const { getLevels, getPackages, getDependencyGraph } = require('./util')

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
    ['lerna', 'exec', 'yarn', 'build', ...scopes],
    { stdio: 'inherit' },
  )
  if (signal || (status !== null && status > 0)) {
    process.exit(status || 1)
  }
})

fs.mkdirSync(path.join('component_test', 'packed'), { recursive: true })
