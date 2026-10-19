// Collapses the take's static stretches and burns the caption strip into a
// band under the browser window. The desktop harness paints its strip into the
// app; a public site is not ours to paint into, so the timing is recovered
// here — a frame carries the caption index it was shot under, and a cue spans
// the deduped run of frames sharing one index.
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const outDir = process.argv[2]
const HOLD = Number(process.argv[3] ?? 0.6)
const STRIP = 118
const { captions, frames } = JSON.parse(
  fs.readFileSync(path.join(outDir, 'timeline.json')),
)

const hash = file =>
  crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')

const groups = []
for (const f of frames) {
  if (!fs.existsSync(f.file)) {
    continue
  }
  const h = hash(f.file)
  const last = groups.at(-1)
  if (last && last.hash === h && last.cap === f.cap) {
    last.count++
  } else {
    groups.push({ hash: h, file: f.file, cap: f.cap, count: 1 })
  }
}

const FRAME = 0.22
// see encode.mjs: only binds when HOLD is raised above it
const MIN = 0.8
const held = g => Math.min(Math.max(g.count * FRAME, MIN), HOLD)

const lines = []
const cues = []
let clock = 0
for (const g of groups) {
  const d = held(g)
  lines.push(`file '${g.file}'`, `duration ${d.toFixed(3)}`)
  const last = cues.at(-1)
  if (last && last.cap === g.cap) {
    last.end = clock + d
  } else {
    cues.push({ cap: g.cap, start: clock, end: clock + d })
  }
  clock += d
}
lines.push(`file '${groups.at(-1).file}'`)
const listFile = path.join(outDir, 'frames.dedup.txt')
fs.writeFileSync(listFile, `${lines.join('\n')}\n`)

const ts = s => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return `${h}:${String(m).padStart(2, '0')}:${sec}`
}
const esc = s =>
  String(s)
    .replaceAll('\\', '\\\\')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}')
    .replaceAll(/\s+/g, ' ')
    .trim()
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

const W = 1920
const H = 1290 + STRIP
const head = [
  '[Script Info]',
  'ScriptType: v4.00+',
  `PlayResX: ${W}`,
  `PlayResY: ${H}`,
  'WrapStyle: 2',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Q,Helvetica Neue,34,&H00FFFFFF,&H00000000,&H00000000,1,1,0,0,7,0,0,0,1',
  'Style: A,Helvetica Neue,34,&H00F7A27A,&H00000000,&H00000000,1,1,0,0,7,0,0,0,1',
  'Style: S,Menlo,24,&H00B8A38F,&H00000000,&H00000000,0,1,0,0,7,0,0,0,1',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
]
const events = []
for (const c of cues) {
  const cap = captions[c.cap] ?? { question: '', status: '' }
  const y = 1290
  events.push(
    `Dialogue: 0,${ts(c.start)},${ts(c.end)},A,,0,0,0,,{\\pos(34,${y + 20})}you ❯`,
    `Dialogue: 0,${ts(c.start)},${ts(c.end)},Q,,0,0,0,,{\\pos(126,${y + 20})}${clip(esc(cap.question), 105)}`,
  )
  if (cap.status) {
    events.push(
      `Dialogue: 0,${ts(c.start)},${ts(c.end)},S,,0,0,0,,{\\pos(34,${y + 68})}${clip(esc(cap.status), 152)}`,
    )
  }
}
const assFile = path.join(outDir, 'captions.ass')
fs.writeFileSync(assFile, `${[...head, ...events].join('\n')}\n`)

console.log(
  `${frames.length} frames -> ${groups.length} distinct, ${clock.toFixed(0)}s, ${cues.length} cues`,
)

const mp4 = path.join(outDir, 'browser-agent-demo.mp4')
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
    `scale=1920:-2,pad=${W}:${H}:0:0:color=#0b0d11,ass=${assFile},format=yuv420p`,
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
  '-show_entries',
  'stream=width,height',
  '-of',
  'default=nw=1',
  mp4,
]).toString()
console.log(mp4, probe.trim().replaceAll('\n', ' '))
