// A real agent session runs at its own pace, and most of it is the app sitting
// still while the model thinks. This collapses a run of identical frames to a
// short hold, so every state change plays at its own speed and the waits do
// not.
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const outDir = process.argv[2]
const HOLD = Number(process.argv[3] ?? 0.6) // seconds a static stretch gets
const framesDir = path.join(outDir, 'frames')
const files = fs
  .readdirSync(framesDir)
  .filter(f => f.endsWith('.png'))
  .sort()
  .map(f => path.join(framesDir, f))

const hash = file =>
  crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')

const groups = []
for (const file of files) {
  const h = hash(file)
  const last = groups.at(-1)
  if (last && last.hash === h) {
    last.count++
  } else {
    groups.push({ hash: h, file, count: 1 })
  }
}

const FRAME = 0.25 // roughly what the camera loop achieved per shot
// a caption has to be readable even if the state was brief — but this only
// binds when HOLD is raised above it, and HOLD defaults to 0.6, so by default
// every distinct state gets exactly HOLD. Raise both together to slow a clip
// down; raising HOLD alone past 0.8 is what turns this back on.
const MIN = 0.8
const held = g => Math.min(Math.max(g.count * FRAME, MIN), HOLD)
const lines = []
for (const g of groups) {
  lines.push(`file '${g.file}'`, `duration ${held(g).toFixed(3)}`)
}
lines.push(`file '${groups.at(-1).file}'`)
const listFile = path.join(outDir, 'frames.dedup.txt')
fs.writeFileSync(listFile, `${lines.join('\n')}\n`)

const total = groups.reduce((sum, g) => sum + held(g), 0)
console.log(
  `${files.length} frames -> ${groups.length} distinct, ${total.toFixed(0)}s (from ${(files.length * FRAME).toFixed(0)}s)`,
)

const mp4 = path.join(outDir, 'mcp-agent-demo.mp4')
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-vf',
    'scale=1920:-2,format=yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '25',
    '-movflags',
    '+faststart',
    '-r',
    '24',
    mp4,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)
// the poster the review card and any embed use: the state the take ends in
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-sseof',
    '-1',
    '-i',
    mp4,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    mp4.replace(/\.mp4$/, '.jpg'),
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)

const probe = execFileSync('ffprobe', [
  '-v',
  'error',
  '-show_entries',
  'format=duration,size',
  '-of',
  'default=nw=1',
  mp4,
]).toString()
console.log(mp4, probe.trim().replaceAll('\n', ' '))
