// The clips the review server offers for approval, and the byte serving a
// <video> needs.
//
// A clip is reviewed the way a figure is — watched, then approved or denied —
// but nothing else about a figure applies: there is no baseline to compare
// against, no store to publish to, and no live session behind it. So this is
// its own list and its own report rather than a shape bolted onto SpecEntry.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type http from 'node:http'

export interface Clip {
  // stable id and the name a verdict is recorded under: the path under its
  // root, without the extension, so two roots cannot collide on a basename
  name: string
  file: string
  bytes: number
  modified: string
  // seconds, from the mp4's own header; undefined when it cannot be read
  duration?: number
  poster?: string
  // whatever the shoot wrote beside the clip: the questions asked and what the
  // agent did, so the reviewer reads what they are watching
  transcript?: string
}

const MP4 = '.mp4'

function walk(dir: string, root: string, out: Clip[]) {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, root, out)
    } else if (entry.isFile() && entry.name.endsWith(MP4)) {
      const stat = fs.statSync(full)
      const base = full.slice(0, -MP4.length)
      const poster = ['.jpg', '.png'].find(ext => fs.existsSync(base + ext))
      out.push({
        name: path.relative(root, base).replaceAll(path.sep, '/'),
        file: full,
        bytes: stat.size,
        modified: stat.mtime.toISOString(),
        duration: mp4Duration(full),
        ...(poster ? { poster: base + poster } : {}),
        ...(fs.existsSync(`${path.dirname(full)}/transcript.json`)
          ? { transcript: `${path.dirname(full)}/transcript.json` }
          : {}),
      })
    }
  }
}

export function collectClips(roots: readonly string[]) {
  const clips: Clip[] = []
  for (const root of roots) {
    walk(root, root, clips)
  }
  return clips.sort((a, b) => b.modified.localeCompare(a.modified))
}

// Duration off the mvhd atom rather than by spawning ffprobe: the review server
// starts with no tools of its own, and a missing duration is only a label.
export function mp4Duration(file: string) {
  let fd
  try {
    fd = fs.openSync(file, 'r')
    const size = fs.fstatSync(fd).size
    // mvhd lives inside moov, which the encode's +faststart puts near the
    // front; scan the first megabyte and give up rather than read the file.
    const head = Buffer.alloc(Math.min(size, 1_000_000))
    fs.readSync(fd, head, 0, head.length, 0)
    const at = head.indexOf('mvhd')
    if (at < 0) {
      return undefined
    }
    // `at` points at the type field. Past it: version(1) + flags(3), then the
    // body — two timestamps, the timescale, the duration, each 4 bytes wide at
    // version 0 and the timestamps 8 at version 1.
    const version = head.readUInt8(at + 4)
    const body = at + 8 + (version === 1 ? 16 : 8)
    const timescale = head.readUInt32BE(body)
    const units =
      version === 1
        ? Number(head.readBigUInt64BE(body + 4))
        : head.readUInt32BE(body + 4)
    return timescale > 0 ? units / timescale : undefined
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd)
    }
  }
}

// A verdict has to be stamped with what was watched, the way a figure's is
// stamped with the pixels. Hashing a whole mp4 on every write is seconds of
// work for no more identity than its size and mtime carry, so this is the
// cheap stand-in — it changes on every re-shoot, which is the only event a
// stale verdict has to survive.
export function clipStamp(clip: Clip | undefined) {
  return clip
    ? crypto
        .createHash('sha1')
        .update(`${clip.bytes}:${clip.modified}`)
        .digest('hex')
    : undefined
}

const RANGE = /^bytes=(\d*)-(\d*)$/

// Range serving, because a <video> that cannot seek is one a reviewer cannot
// scrub, and Safari refuses to play a source that answers a range request with
// the whole file.
export function serveClipBytes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  file: string,
  contentType: string,
) {
  const size = fs.statSync(file).size
  const match = RANGE.exec(req.headers.range ?? '')
  const start = match?.[1] ? Number(match[1]) : 0
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (start >= size || end < start) {
    res.writeHead(416, { 'content-range': `bytes */${size}` })
    res.end()
    return
  }
  res.writeHead(match ? 206 : 200, {
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'content-length': end - start + 1,
    ...(match ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}),
  })
  const stream = fs.createReadStream(file, { start, end })
  stream.on('error', () => {
    res.destroy()
  })
  stream.pipe(res)
}
