import { spawnSync } from 'child_process'
import fs from 'fs'

import tmp from 'tmp'

export function booleanize(str: string) {
  return str === 'false' ? false : !!str
}

function createTmp() {
  return tmp.fileSync({
    mode: 0o644,
    prefix: 'jbrowse-img-',
    postfix: '.svg',
  })
}

export function convert(
  result: string,
  args: { out: string; pngwidth?: string },
  spawnArgs: string[] = [],
) {
  const { name } = createTmp()
  const { pngwidth = '2048', out } = args
  fs.writeFileSync(name, result)
  const a = ['-w', pngwidth, name, '-o', out, ...spawnArgs]
  const ls = spawnSync('rsvg-convert', a)
  try {
    const stderr = ls.stderr.toString()
    const stdout = ls.stdout.toString()
    if (stderr) {
      console.error(`rsvg-convert stderr: ${stderr}`)
    }
    if (stdout) {
      console.log(`rsvg-convert stdout: ${stdout}`)
    }
    if (ls.error) {
      throw ls.error
    }
    if (ls.status !== 0) {
      throw new Error(`rsvg-convert exited with code ${ls.status}`)
    }
  } finally {
    fs.unlinkSync(name)
  }
}
