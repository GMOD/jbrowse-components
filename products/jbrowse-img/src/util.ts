import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

import { DEFAULT_WIDTH } from './options.ts'

export const STDIN_ARG = '-'

let stdinConsumed = false

export function readStdin() {
  // a second read of fd 0 yields nothing, which would surface as a JSON error
  if (stdinConsumed) {
    throw new Error('stdin ("-") can only be read once per command')
  }
  stdinConsumed = true
  return fs.readFileSync(0, 'utf8')
}

export function readTextInput(file: string) {
  return file === STDIN_ARG ? readStdin() : fs.readFileSync(file, 'utf8')
}

export function isFile(file: string) {
  try {
    return fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true
  } catch {
    return false
  }
}

const OUT_FORMAT = /\.(svg|png|pdf)$/i

export function outFormat(outFile: string) {
  const format = OUT_FORMAT.exec(outFile)?.[1]?.toLowerCase()
  if (!format) {
    throw new Error(
      `--out needs a .svg, .png or .pdf path, got "${outFile}" (for .jpg or .webp, @jbrowse/capture screenshots the live app)`,
    )
  }
  return format
}

export function writeRendered(
  result: string,
  outFile: string | undefined,
  width: number,
) {
  if (outFile) {
    const format = outFormat(outFile)
    if (format === 'svg') {
      fs.writeFileSync(outFile, result)
    } else {
      convert(
        result,
        { out: outFile, width: String(width) },
        format === 'pdf' ? ['-f', 'pdf'] : [],
      )
    }
  } else {
    console.log(result)
  }
}

export function convert(
  result: string,
  args: { out: string; width?: string },
  spawnArgs: string[] = [],
) {
  const { width = String(DEFAULT_WIDTH), out } = args
  const ls = spawnSync('rsvg-convert', ['-w', width, '-o', out, ...spawnArgs], {
    input: result,
  })
  // a failed spawn leaves stdout and stderr unset
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
}
