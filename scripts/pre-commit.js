/**
 * Pre-commit hook to format changed non-JS/TS files
 * JS/TS files ignored since ESLint provides formatting feedback for those
 */

const spawn = require('cross-spawn')

function main() {
  // Get names of files that were changed
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
      changedFiles.push('products/jbrowse-cli/README.md')
    }
  }
  // Filter out JS/TS files
  const filesToFormat = changedFiles.filter(fileName => !isJSOrTSFile(fileName))
  // Run prettier formatting on non-JS/TS files
  if (filesToFormat.length) {
    spawn.sync(
      'yarn',
      ['prettier', ...filesToFormat, '--write', '--ignore-unknown'],
      { stdio: 'inherit' },
    )
    spawn.sync('git', ['add', ...filesToFormat], { stdio: 'inherit' })
  }
}

function isJSOrTSFile(fileName) {
  return (
    fileName.endsWith('.js') ||
    fileName.endsWith('.jsx') ||
    fileName.endsWith('.ts') ||
    fileName.endsWith('tsx')
  )
}

main()
