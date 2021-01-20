#!/usr/bin/env node

const spawn = require('cross-spawn')
const path = require('path')

function main() {
  const devTools = require.resolve('@jbrowse/development-tools')
  const patchPackage = require.resolve('patch-package')
  const patchDir = path.relative(
    '',
    path.join(path.dirname(devTools), 'patches/'),
  )
  const { signal, status } = spawn.sync(
    'node',
    [patchPackage, '--patch-dir', patchDir],
    { stdio: 'inherit' },
  )
  if (signal || (status !== null && status > 0)) {
    process.exit(status || 1)
  }
}
main()
