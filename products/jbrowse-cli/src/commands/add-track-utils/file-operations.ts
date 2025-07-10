import fs from 'fs'
import path from 'path'

const { copyFile, rename, symlink } = fs.promises
const { COPYFILE_EXCL } = fs.constants

export function fileOperation({
  srcFilename,
  destFilename,
  mode,
}: {
  srcFilename: string
  destFilename: string
  mode: string
}) {
  if (mode === 'copy') {
    return copyFile(srcFilename, destFilename, COPYFILE_EXCL)
  } else if (mode === 'move') {
    return rename(srcFilename, destFilename)
  } else if (mode === 'symlink') {
    return symlink(path.resolve(srcFilename), destFilename)
  }
  return undefined
}

export function destinationFn({
  destinationDir,
  srcFilename,
  subDir,
  force,
}: {
  destinationDir: string
  srcFilename: string
  subDir: string
  force: boolean
}) {
  const dest = path.resolve(
    path.join(destinationDir, subDir, path.basename(srcFilename)),
  )
  if (force) {
    try {
      fs.unlinkSync(dest)
    } catch (e) {
      /* unconditionally unlinkSync, due to
       * https://github.com/nodejs/node/issues/14025#issuecomment-754021370
       * and https://github.com/GMOD/jbrowse-components/issues/2768 */
    }
  }
  return dest
}
