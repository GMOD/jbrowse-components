import fs from 'fs'
import path from 'path'

import { ignoreNotFound } from '../../utils.ts'

const { copyFile, rename, symlink, unlink } = fs.promises
const { COPYFILE_EXCL } = fs.constants

export async function loadFile({
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
  if (mode) {
    if (subDir) {
      fs.mkdirSync(path.join(destDir, subDir), { recursive: true })
    }
    await Promise.all(
      files
        .filter((f): f is string => !!f)
        .map(src => loadFile({ src, destDir, mode, subDir, force })),
    )
  }
}
