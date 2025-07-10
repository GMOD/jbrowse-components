import fs from 'fs'
import path from 'path'

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
    try {
      await unlink(dest)
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e
      }
    }
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