// Does a finished clip actually MOVE?
//
//   node scripts/probe-clip-motion.ts static/media/pangenome/pggb_layout_switch.mp4
//
// The question a duration cannot answer, and the one filming more than one tour
// at a time raises: headless Chrome paints the foreground tab, so a screencast
// taken on a backgrounded one can deliver the same frame over and over. That
// clip has the right length, the right size, and a `keptUp` of 1.00 — every
// number the run reports is fine and the picture is frozen.
//
// Counts distinct frames by content hash over evenly spaced samples. A tour that
// is doing anything changes most of them; a frozen capture collapses to a
// handful.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SAMPLES = 24

async function distinctFrames(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    file,
  ])
  const duration = Number.parseFloat(stdout.trim())
  if (!Number.isFinite(duration)) {
    throw new Error(`${file}: no duration`)
  }
  const hashes = await Promise.all(
    Array.from({ length: SAMPLES }, async (_, i) => {
      const at = (duration * (i + 0.5)) / SAMPLES
      // Downscaled to a thumbnail, so the count answers "did the picture
      // change" rather than "did the encoder pick different noise".
      const { stdout: png } = await execFileAsync(
        'ffmpeg',
        [
          '-v',
          'error',
          '-ss',
          at.toFixed(3),
          '-i',
          file,
          '-frames:v',
          '1',
          '-vf',
          'scale=160:-2',
          '-f',
          'image2pipe',
          '-vcodec',
          'png',
          'pipe:1',
        ],
        { encoding: 'buffer', maxBuffer: 1 << 24 },
      )
      return createHash('sha1').update(png).digest('hex')
    }),
  )
  return { duration, distinct: new Set(hashes).size }
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: probe-clip-motion.ts <clip.mp4>...')
  process.exit(1)
}
let frozen = 0
for (const file of files) {
  const { duration, distinct } = await distinctFrames(file)
  // A tour is a route through a UI: menus open, views arrive, a cursor crosses
  // the frame. Under a third of the samples differing is not pacing, it is a
  // capture that stopped following the page.
  const ok = distinct > SAMPLES / 3
  if (!ok) {
    frozen++
  }
  console.log(
    `${ok ? '  ok' : 'FROZEN'} ${distinct}/${SAMPLES} distinct ` +
      `over ${duration.toFixed(1)}s  ${file}`,
  )
}
process.exit(frozen > 0 ? 1 : 0)
