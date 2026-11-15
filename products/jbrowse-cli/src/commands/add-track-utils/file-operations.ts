import fs from 'node:fs'
import path from 'node:path'

import { ignoreNotFound } from '../../utils.ts'

const { copyFile, rename, symlink, unlink } = fs.promises
const { COPYFILE_EXCL } = fs.constants

async function loadFile({
  src,
  destDir,
  mode,
  subDir = '',
  force = false,
}: {
  src: string
  destDir: string
  mode: string
  subDir?: string
  force?: boolean
}) {
  if (mode === 'inPlace') {
    return
  }
  const dest = path.join(destDir, subDir, path.basename(src))
  // the file already sits where the config wants it (add-track run from inside
  // the install dir), so there is nothing to copy/move/link. Bailing before the
  // force-unlink matters: dest and src are the same file, so unlinking it
  // deleted the user's data and left the copy with nothing to read. A source
  // that isn't there still has to fail, so fall through to get its ENOENT.
  if (path.resolve(src) === path.resolve(dest) && fs.existsSync(src)) {
    return
  }
  if (force) {
    await ignoreNotFound(unlink(dest))
  }

  if (mode === 'copy') {
    return copyFile(src, dest, force ? 0 : COPYFILE_EXCL)
  }
  if (mode === 'move') {
    return rename(src, dest)
  }
  if (mode === 'symlink') {
    return symlink(path.resolve(src), dest)
  }
  return undefined
}

const indexWriters: [RegExp, string][] = [
  [/\.(bai|crai)$/i, 'samtools index'],
  [/\.(fai|gzi)$/i, 'samtools faidx'],
  [/\.(tbi|csi)$/i, 'tabix'],
]

function missingSourceMessage(src: string) {
  const writer = indexWriters.find(([re]) => re.test(src))?.[1]
  return writer ? `Missing ${src} (${writer} writes it)` : `Missing ${src}`
}

// load a set of source files into the config directory, skipping the operation
// entirely when no load mode is given (e.g. a URL track). undefined entries
// (optional index/bed files) are ignored
export async function loadFiles({
  files,
  destDir,
  mode,
  subDir,
  force,
}: {
  files: (string | undefined)[]
  destDir: string
  mode?: string
  subDir?: string
  force?: boolean
}) {
  // inPlace references files where they sit, so it needs no destination dir
  if (mode && mode !== 'inPlace') {
    const sources = files.filter((f): f is string => !!f)
    const missing = sources.find(src => !fs.existsSync(src))
    if (missing) {
      throw new Error(missingSourceMessage(missing))
    }
    if (subDir) {
      fs.mkdirSync(path.join(destDir, subDir), { recursive: true })
    }
    await Promise.all(
      sources.map(src => loadFile({ src, destDir, mode, subDir, force })),
    )
  }
}
