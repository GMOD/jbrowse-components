#!/usr/bin/env node
const cp = require('child_process')
const fs = require('fs').promises
const path = require('path')

async function getFiles(dir) {
  let files = await fs.readdir(dir)
  files = await Promise.all(
    files.map(async file => {
      if (
        file === 'node_modules' ||
        file === 'dist' ||
        file === 'umd' ||
        file === 'build' ||
        file === 'coverage' ||
        file === 'templates'
      ) {
        return null
      }
      const filePath = path.resolve(path.join(dir, file))
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        return getFiles(filePath)
      }
      if (
        !(
          file.endsWith('.ts') ||
          file.endsWith('.tsx') ||
          file.endsWith('.js') ||
          file.endsWith('.jsx')
        )
      ) {
        return null
      }
      if (stats.isFile()) {
        return filePath
      }
      return null
    }),
  )

  return files.filter(Boolean).flat()
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
  const child = cp.spawn('yarn', ['tsserver'])

  const files = await getFiles('.')
  files.forEach((file, idx) => {
    child.stdin.write(
      `${JSON.stringify({
        seq: idx * 2,
        type: 'request',
        command: 'open',
        arguments: { file },
      })}\n`,
    )
    child.stdin.write(
      `${JSON.stringify({
        seq: idx * 2 + 1,
        type: 'request',
        command: 'suggestionDiagnosticsSync',
        arguments: { file },
      })}\n`,
    )
  })

  child.stdout.on('data', data => {
    const lines = data
      .toString()
      .split(/\r?\n/)
      .filter(line => line.startsWith('{'))
    lines.forEach(line => {
      let response
      try {
        response = JSON.parse(line)
      } catch (error) {
        console.error(data.toString())
      }
      if (response.request_seq && response.body?.length) {
        const warnings = []
        response.body.forEach(contents => {
          warnings.push(
            `${contents.start.line}:${contents.start.offset}-${contents.end.line}:${contents.end.offset} ${contents.text}`,
          )
        })
        if (warnings.length) {
          console.log(files[(response.request_seq - 1) / 2])
          warnings.forEach(warning => {
            console.log(warning)
          })
          console.log()
        }
      }
    })
  })
  child.stdin.end()
})()
