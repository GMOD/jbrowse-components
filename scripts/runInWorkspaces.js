
const { spawn } = require('child_process')
const { EOL } = require('os')

const [command, ...scopes] = process.argv.slice(2)

const child = spawn('yarn', ['workspaces', 'info', '--json'])

let data = ''
child.stdout.on('data', chunk => {
  data += chunk
})

child.on('close', code => {
  if (code !== 0) {
    process.exit(code)
  }

  const lines = data.split(EOL)
  const firstLine = lines.findIndex(line => line.startsWith('{'))
  const lastLine = lines.findLastIndex(line => line.startsWith('}'))
  const info = JSON.parse(lines.slice(firstLine, lastLine + 1).join(''))

  const workspacesToRun = Object.keys(info).filter(workspace => {
    return scopes.some(scope => {
      if (scope.endsWith('*')) {
        return workspace.startsWith(scope.slice(0, -1))
      }
      return workspace === scope
    })
  })

  for (const workspace of workspacesToRun) {
    const location = info[workspace].location
    spawn('yarn', [command], { cwd: location, stdio: 'inherit' })
  }
})
