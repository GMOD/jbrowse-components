const spawn = require('cross-spawn')

const changedFiles = spawn
  .sync('git', ['diff', '--cached', '--name-status'], { encoding: 'utf8' })
  .stdout.trim()
  .split(/[\r\n]+/)
  // Ignore deleted files
  .map(line => (line.startsWith('D\t') ? undefined : line.split('\t')[1]))
  .filter(Boolean)

// If anything in the CLI code changed, re-generate the README docs and format
if (changedFiles.some(fileName => fileName.includes('jbrowse-cli'))) {
  spawn.sync('yarn', ['lerna', 'run', '--scope', '@jbrowse/cli', 'docs'], {
    stdio: 'inherit',
  })
  if (!changedFiles.includes('products/jbrowse-cli/README.md')) {
    spawn.sync('git', ['add', 'products/jbrowse-cli/README.md'], {
      stdio: 'inherit',
    })
  }
}
