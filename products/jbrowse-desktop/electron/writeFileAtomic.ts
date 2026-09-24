import fs from 'node:fs'

import { ENCODING } from './paths.ts'

const { open, unlink } = fs.promises

// Every JSON file the app owns is rewritten whole — session files and
// recent_sessions.json once a second for as long as a session is open,
// globalPlugins.json on every edit in the dialog. writeFile truncates the
// destination first, so a crash, a full disk, or the app being killed mid-write
// leaves a truncated file where the user's data used to be, and the odds of
// landing in that window are proportional to how often it is written.
//
// Write a sibling temp file and rename it into place instead: rename is atomic,
// so a reader sees the whole old file or the whole new one, never half of
// either. The temp is in the destination's own directory, so the rename never
// has to cross a filesystem, and its name carries the pid and a counter so two
// writers (two saves of the same session racing) can't share one.
let tmpFileCounter = 0

// Windows refuses to rename over a file another process holds open — antivirus
// or the search indexer reading what was just written — for as long as it holds
// it, which is well under a second. Elsewhere these codes mean a permission
// problem that no retry fixes.
const RENAME_RETRY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])
const RENAME_RETRIES = 8

async function renameRetrying(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(from, to)
      return
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (
        process.platform !== 'win32' ||
        attempt >= RENAME_RETRIES ||
        !RENAME_RETRY_CODES.has(code ?? '')
      ) {
        throw e
      }
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt))
    }
  }
}

// The rename makes the swap atomic against a *reader*, which is a different
// guarantee from surviving a crash: the temp file's bytes may still be in the
// page cache when the rename lands, so a power loss can leave the new name
// pointing at a zero-length or partial file — the same lost session the rename
// was added to prevent, just through a narrower window. Flushing the data before
// the rename is what closes it, and it is cheap next to the write itself.
export async function writeFileAtomic(filePath: string, data: string) {
  const tmpPath = `${filePath}.${process.pid}.${tmpFileCounter++}.tmp`
  try {
    const handle = await open(tmpPath, 'w')
    try {
      await handle.writeFile(data, ENCODING)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await renameRetrying(tmpPath, filePath)
  } catch (e) {
    // the write failed or never landed; don't leave the fragment next to the
    // file it was going to replace
    await unlink(tmpPath).catch(() => {})
    throw e
  }
}
