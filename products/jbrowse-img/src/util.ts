import { spawnSync } from 'child_process'
import fs from 'fs'
import tmp from 'tmp'

// nice helper function from https://stackoverflow.com/questions/263965/
export function booleanize(str: string) {
  return str === 'false' ? false : !!str
}

function createTmp() {
  return tmp.fileSync({
    mode: 0o644,
    prefix: 'prefix-',
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
  const a = ['-w', pngwidth, name, '-o', out, ...spawnArgs] as string[]
  const ls = spawnSync('rsvg-convert', a)

  console.error(`rsvg-convert stderr: ${ls.stderr.toString()}`)
  console.log(`rsvg-convert stdout: ${ls.stdout.toString()}`)
  fs.unlinkSync(name)
}
