import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

import { ignoreNotFound } from '../../utils.ts'

const { copyFile, rename, symlink, unlink } = fs.promises
const { COPYFILE_EXCL } = fs.constants

// A GenBank file is an assembly and a track at once, so `add-assembly x.gbk
// --load copy` then `add-track x.gbk --load copy` copies it twice; the second
// finds its own copy already there and has nothing left to do. Under --force
// the copy replaces it, which is cheaper than reading both files. A symlink
// left by an earlier --load symlink is not a copy, so it still fails EEXIST.
async function sameBytes(src: string, dest: string) {
  const [a, b] = await Promise.all([
    fs.promises.stat(src).catch(() => undefined),
    fs.promises.lstat(dest).catch(() => undefined),
  ])
  return (
    !!a && !!b?.isFile() && a.size === b.size && (await sameChunks(src, dest))
  )
}

async function sameChunks(src: string, dest: string) {
  const chunk = 1 << 20
  const [x, y] = await Promise.all([
    fs.promises.open(src),
    fs.promises.open(dest),
  ])
  const bufferX = Buffer.alloc(chunk)
  const bufferY = Buffer.alloc(chunk)
  try {
    let same = true
    for (let pos = 0, read = chunk; same && read === chunk; pos += chunk) {
      const [p, q] = await Promise.all([
        x.read(bufferX, 0, chunk, pos),
        y.read(bufferY, 0, chunk, pos),
      ])
      same =
        p.bytesRead === q.bytesRead &&
        p.buffer
          .subarray(0, p.bytesRead)
          .equals(q.buffer.subarray(0, q.bytesRead))
      read = p.bytesRead
    }
    return same
  } finally {
    await Promise.all([x.close(), y.close()])
  }
}

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
  if (
    (path.resolve(src) === path.resolve(dest) && fs.existsSync(src)) ||
    (mode === 'copy' && !force && (await sameBytes(src, dest)))
  ) {
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
