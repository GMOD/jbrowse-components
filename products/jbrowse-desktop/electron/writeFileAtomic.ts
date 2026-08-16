import fs from 'node:fs'

import { ENCODING } from './paths.ts'

const { open, unlink, rename } = fs.promises

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
    await rename(tmpPath, filePath)
  } catch (e) {
    // the write failed or never landed; don't leave the fragment next to the
    // file it was going to replace
    await unlink(tmpPath).catch(() => {})
    throw e
  }
}
