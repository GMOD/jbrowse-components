import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

import { fileSync } from 'tmp'

import { wantsRScript } from './options.ts'

// `-` as a file argument means stdin, so a JSON input can be piped in rather
// than staged as a file: `jq … | jb2export --spec -`
export const STDIN_ARG = '-'

let stdinConsumed = false

export function readStdin() {
  // reading fd 0 twice yields nothing the second time, which would surface as a
  // baffling JSON parse error rather than the mistake it is
  if (stdinConsumed) {
    throw new Error('stdin ("-") can only be read once per command')
  }
  stdinConsumed = true
  return fs.readFileSync(0, 'utf8')
}

export function readTextInput(file: string) {
  return file === STDIN_ARG ? readStdin() : fs.readFileSync(file, 'utf8')
}

// Write a rendered SVG: to stdout when no `outFile`, else by extension. .png and
// .pdf route through rsvg-convert (.pdf via `-f pdf`); anything else is the raw
// SVG. Both raster formats honor `width` so PDF matches PNG.
//
// One function for the single render and for each image of a batch, so `--format
// pdf` means the same thing as `--out fig.pdf` rather than being a second,
// smaller list of formats that batch happens to know.
export function writeRendered(
  result: string,
  outFile: string | undefined,
  width: number,
) {
  if (!outFile) {
    console.log(result)
    return
  }
  const lower = outFile.toLowerCase()
  // `.R` is not an image at all — the result is already R source, so it goes out
  // verbatim rather than through a converter that would read it as SVG.
  if (wantsRScript(outFile)) {
    fs.writeFileSync(outFile, result)
  } else if (lower.endsWith('.png')) {
    convert(result, { out: outFile, width: String(width) })
  } else if (lower.endsWith('.pdf')) {
    convert(result, { out: outFile, width: String(width) }, ['-f', 'pdf'])
  } else {
    // Only .png/.pdf are converted; everything else gets the raw SVG. Say so for
    // an extension that asks for something else, since `--out fig.jpg` otherwise
    // wrote SVG bytes under a name no viewer will open as SVG.
    if (!lower.endsWith('.svg')) {
      console.warn(
        `Warning: writing SVG to "${outFile}"; only .png and .pdf are converted`,
      )
    }
    fs.writeFileSync(outFile, result)
  }
}

export function convert(
  result: string,
  args: { out: string; width?: string },
  spawnArgs: string[] = [],
) {
  const { name } = fileSync({
    mode: 0o644,
    prefix: 'jbrowse-img-',
    postfix: '.svg',
  })
  const { width = '2048', out } = args
  fs.writeFileSync(name, result)
  const a = ['-w', width, name, '-o', out, ...spawnArgs]
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
