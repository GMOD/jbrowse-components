import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

import { fileSync } from 'tmp'

export function booleanize(str: string) {
  return str === 'false' ? false : !!str
}

export function convert(
  result: string,
  args: { out: string; pngwidth?: string },
  spawnArgs: string[] = [],
) {
  const { name } = fileSync({
    mode: 0o644,
    prefix: 'jbrowse-img-',
    postfix: '.svg',
  })
  const { pngwidth = '2048', out } = args
  fs.writeFileSync(name, result)
  const a = ['-w', pngwidth, name, '-o', out, ...spawnArgs]
  const ls = spawnSync('rsvg-convert', a)
  try {
    // The spawn itself failing (e.g. rsvg-convert not installed) leaves
    // stdout/stderr unset, so check ls.error before touching them — otherwise a
    // missing binary surfaces as a confusing "cannot read toString of undefined"
    // instead of naming the real problem.
    if (ls.error) {
      const notFound = 'code' in ls.error && ls.error.code === 'ENOENT'
      throw new Error(
        notFound
          ? 'rsvg-convert not found: install librsvg to export PNG/PDF (e.g. `apt install librsvg2-bin` or `brew install librsvg`)'
          : `failed to run rsvg-convert: ${ls.error.message}`,
        { cause: ls.error },
      )
    }
    const stderr = ls.stderr.toString()
    const stdout = ls.stdout.toString()
    if (stderr) {
      console.error(`rsvg-convert stderr: ${stderr}`)
    }
    if (stdout) {
      console.log(`rsvg-convert stdout: ${stdout}`)
    }
    if (ls.status !== 0) {
      throw new Error(`rsvg-convert exited with code ${ls.status}`)
    }
  } finally {
    fs.unlinkSync(name)
  }
}
