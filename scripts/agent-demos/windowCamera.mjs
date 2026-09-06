// Films two windows by id rather than recording the screen. Screen capture
// takes whatever is in front, so anything the operator does during a take —
// switching apps, reading mail — lands in the clip, and the take is unusable.
// Window capture returns the window on any Mission Control space, occluded or
// not, with no desktop, dock or menu bar around it.
//
// The cost is framerate: one `screencapture -l` is ~195 ms, so two windows in
// parallel is about 4 fps. That is fine for a screen demo, which is text
// appearing rather than motion.
import { execFile, execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const shot = (windowId, file) =>
  new Promise(resolve => {
    execFile(
      '/usr/sbin/screencapture',
      ['-x', '-o', '-t', 'jpg', '-l', String(windowId), file],
      () => {
        resolve(fs.existsSync(file) && fs.statSync(file).size > 1000)
      },
    )
  })

export function startCamera({ sources, outDir, intervalMs = 250 }) {
  for (const source of sources) {
    fs.mkdirSync(path.join(outDir, source.key), { recursive: true })
  }
  const state = { filming: true, frames: 0, missed: 0 }

  const loop = (async () => {
    while (state.filming) {
      const started = Date.now()
      const index = String(state.frames).padStart(5, '0')
      const results = await Promise.all(
        sources.map(source =>
          shot(source.windowId, path.join(outDir, source.key, `f${index}.jpg`)),
        ),
      )
      // a tick is kept only if every window answered, so the streams stay
      // index-aligned and can be stacked in one ffmpeg pass
      if (results.every(Boolean)) {
        state.frames++
      } else {
        state.missed++
        for (const source of sources) {
          fs.rmSync(path.join(outDir, source.key, `f${index}.jpg`), {
            force: true,
          })
        }
      }
      const remaining = intervalMs - (Date.now() - started)
      if (remaining > 0) {
        await new Promise(r => {
          setTimeout(r, remaining)
        })
      }
    }
  })()

  return {
    get frames() {
      return state.frames
    },
    get missed() {
      return state.missed
    },
    async stop() {
      state.filming = false
      await loop
      return state
    },
  }
}

const dimensions = file => {
  const out = execFileSync(
    '/usr/bin/sips',
    ['-g', 'pixelWidth', '-g', 'pixelHeight', file],
    { encoding: 'utf8' },
  )
  return {
    w: Number(/pixelWidth:\s*(\d+)/.exec(out)[1]),
    h: Number(/pixelHeight:\s*(\d+)/.exec(out)[1]),
  }
}

export function encode({ sources, outDir, file, fps, speed = 1 }) {
  const sizes = sources.map(source =>
    dimensions(path.join(outDir, source.key, 'f00000.jpg')),
  )
  const height = Math.max(...sizes.map(s => s.h))
  const pads = sources
    .map((_, i) => `[${i}]pad=iw:${height}:0:0:color=0x101010[p${i}]`)
    .join(';')
  const stack = `${sources.map((_, i) => `[p${i}]`).join('')}hstack=inputs=${sources.length}`
  const filter = `${pads};${stack},scale=1920:-2${speed === 1 ? '' : `,setpts=PTS/${speed}`},format=yuv420p`
  // stderr goes to a file, not a pipe: ffmpeg writes a progress line per frame,
  // and execFileSync KILLS the child once maxBuffer (1 MB by default) is passed
  // instead of reporting it — which leaves an mp4 with no moov atom and nothing
  // to say why
  const log = fs.openSync(`${file}.log`, 'w')
  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        ...sources.flatMap(source => [
          '-framerate',
          String(fps),
          '-i',
          path.join(outDir, source.key, 'f%05d.jpg'),
        ]),
        '-filter_complex',
        filter,
        '-c:v',
        'h264_videotoolbox',
        '-b:v',
        '6M',
        file,
      ],
      { stdio: ['ignore', 'ignore', log] },
    )
  } finally {
    fs.closeSync(log)
  }
  const duration = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    file,
  ])
    .toString()
    .trim()
  if (!Number(duration)) {
    throw new Error(`ffmpeg wrote an unplayable ${file}; see ${file}.log`)
  }
  return file
}

// A take is mostly the model thinking, and the published clip has to collapse
// that: 2255 frames of one take held 23 distinct JBrowse states and 253
// distinct terminal states, so nine frames in ten show nothing new.
//
// Exact frame identity finds none of them. The TUI's spinner and token counter
// animate throughout, and one changed glyph is a different frame — hashing kept
// 1442 of 2255. `mpdecimate` compares with a tolerance, which is the right
// instrument, and `showinfo` reports the input `pts` of everything it keeps;
// for an image sequence that is the frame index.
//
// Each source also ignores its `skipBottom` fraction, because the spinner is
// inside the picture. On a 79x40 terminal it sits around 74% of the way down,
// so 0.27 excludes it and 0.24 does not: at `keep` 0.73 the take yields 253
// frames and at 0.76 it yields 1012.
function keptFrames(dir, skipBottom) {
  const keep = 1 - skipBottom
  const filters = [
    ...(keep < 1 ? [`crop=iw:ih*${keep}:0:0`] : []),
    'mpdecimate',
    'showinfo',
  ]
  const run = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'info',
      '-i',
      path.join(dir, 'f%05d.jpg'),
      '-vf',
      filters.join(','),
      '-fps_mode',
      'passthrough',
      '-f',
      'null',
      '-',
    ],
    // showinfo reports on stderr, which is why this is spawnSync — execFileSync
    // hands back stdout only. maxBuffer matters either way: both KILL the child
    // once it is passed rather than reporting it, and the 1 MB default is how a
    // long take ends up with a truncated, unplayable mp4 and nothing said.
    { encoding: 'utf8', maxBuffer: 256 << 20 },
  )
  if (run.error) {
    throw new Error(`could not run ffmpeg over ${dir}`, { cause: run.error })
  }
  const frames = new Set(
    [...run.stderr.matchAll(/Parsed_showinfo.*?\bpts:\s*(\d+)/g)].map(m =>
      Number(m[1]),
    ),
  )
  if (frames.size === 0) {
    throw new Error(`mpdecimate kept no frames from ${dir}`)
  }
  return frames
}

export function encodeCollapsed({
  sources,
  outDir,
  file,
  fps,
  minHold = 0.26,
  maxHold = 0.8,
  crf = 28,
}) {
  const count = fs.readdirSync(path.join(outDir, sources[0].key)).length
  // a frame survives if ANY pane changed at it
  const changed = new Set()
  for (const source of sources) {
    for (const i of keptFrames(
      path.join(outDir, source.key),
      source.skipBottom ?? 0,
    )) {
      changed.add(i)
    }
  }
  const indexes = [...changed].sort((a, b) => a - b)
  const runs = indexes.map((index, n) => ({
    index,
    length: (indexes[n + 1] ?? count) - index,
  }))

  const sizes = sources.map(source =>
    dimensions(path.join(outDir, source.key, 'f00001.jpg')),
  )
  const height = Math.max(...sizes.map(s => s.h))
  const pads = sources
    .map((_, i) => `[${i}]pad=iw:${height}:0:0:color=0x101010[p${i}]`)
    .join(';')
  const stack = `${sources.map((_, i) => `[p${i}]`).join('')}hstack=inputs=${sources.length}`

  const stills = path.join(outDir, '.stills')
  fs.mkdirSync(stills, { recursive: true })
  const lines = []
  for (const [n, run] of runs.entries()) {
    const name = String(run.index + 1).padStart(5, '0')
    const still = path.join(stills, `s${String(n).padStart(5, '0')}.jpg`)
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        ...sources.flatMap(source => [
          '-i',
          path.join(outDir, source.key, `f${name}.jpg`),
        ]),
        '-filter_complex',
        `${pads};${stack},scale=1920:-2`,
        '-q:v',
        '3',
        still,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    )
    run.still = still
    const held = Math.min(Math.max(run.length / fps, minHold), maxHold)
    lines.push(`file '${still}'`, `duration ${held.toFixed(3)}`)
  }
  // the concat demuxer ignores the final entry's duration, so the last still is
  // named twice or it flashes past
  lines.push(`file '${runs.at(-1).still}'`)
  const list = path.join(outDir, 'collapsed.txt')
  fs.writeFileSync(list, `${lines.join('\n')}\n`)

  const log = fs.openSync(`${file}.log`, 'w')
  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        list,
        '-vf',
        'format=yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        String(crf),
        '-r',
        '24',
        '-movflags',
        '+faststart',
        file,
      ],
      { stdio: ['ignore', 'ignore', log] },
    )
  } finally {
    fs.closeSync(log)
  }
  return { file, frames: count, kept: runs.length }
}
