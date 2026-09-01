import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { clipStamp, collectClips, mp4Duration } from './video-review-lib.ts'

// An mvhd box: size, type, version+flags, then the body. The offsets inside it
// are the whole of what mp4Duration does, and reading them one field early
// yields a modification time as a timescale — which is not a wrong duration, it
// is silently no duration at all, since the guard rejects a zero timescale.
function mvhd({
  version,
  timescale,
  units,
}: {
  version: 0 | 1
  timescale: number
  units: number
}) {
  const body = version === 1 ? 16 : 8
  const buf = Buffer.alloc(8 + 4 + body + 4 + (version === 1 ? 8 : 4))
  buf.writeUInt32BE(buf.length, 0)
  buf.write('mvhd', 4)
  buf.writeUInt8(version, 8)
  buf.writeUInt32BE(timescale, 12 + body)
  if (version === 1) {
    buf.writeBigUInt64BE(BigInt(units), 16 + body)
  } else {
    buf.writeUInt32BE(units, 16 + body)
  }
  return buf
}

function writeFake(dir: string, name: string, atom: Buffer) {
  const file = path.join(dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // a plausible ftyp ahead of it, so the scan has to find the atom rather than
  // land on it
  fs.writeFileSync(file, Buffer.concat([Buffer.from('....ftypisom'), atom]))
  return file
}

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clips-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

test('reads a version 0 duration', () => {
  const file = writeFake(
    dir,
    'a.mp4',
    mvhd({ version: 0, timescale: 1000, units: 174_625 }),
  )
  expect(mp4Duration(file)).toBeCloseTo(174.625)
})

test('reads a version 1 duration', () => {
  const file = writeFake(
    dir,
    'b.mp4',
    mvhd({ version: 1, timescale: 600, units: 3600 }),
  )
  expect(mp4Duration(file)).toBeCloseTo(6)
})

test('a file with no mvhd has no duration rather than a wrong one', () => {
  const file = path.join(dir, 'c.mp4')
  fs.writeFileSync(file, Buffer.alloc(4096))
  expect(mp4Duration(file)).toBeUndefined()
})

test('clips are named by their path under the root, so basenames can repeat', () => {
  writeFake(dir, 'take1/demo.mp4', mvhd({ version: 0, timescale: 1, units: 3 }))
  writeFake(dir, 'take2/demo.mp4', mvhd({ version: 0, timescale: 1, units: 4 }))
  expect(
    collectClips([dir])
      .map(c => c.name)
      .sort(),
  ).toEqual(['take1/demo', 'take2/demo'])
})

test('a poster and transcript beside a clip are picked up', () => {
  writeFake(dir, 'take/demo.mp4', mvhd({ version: 0, timescale: 1, units: 1 }))
  fs.writeFileSync(path.join(dir, 'take/demo.jpg'), 'poster')
  fs.writeFileSync(path.join(dir, 'take/transcript.json'), '{}')
  const [clip] = collectClips([dir])
  expect(clip?.poster).toBe(path.join(dir, 'take/demo.jpg'))
  expect(clip?.transcript).toBe(path.join(dir, 'take/transcript.json'))
})

// The stamp is what makes an approval mean "I watched THIS take". A re-shoot
// has to change it, or a verdict silently carries over to a video nobody saw.
test('the stamp changes when a take is re-shot', () => {
  const file = writeFake(
    dir,
    'take/demo.mp4',
    mvhd({ version: 0, timescale: 1, units: 1 }),
  )
  const before = clipStamp(collectClips([dir])[0])
  fs.appendFileSync(file, Buffer.alloc(16))
  fs.utimesSync(file, new Date(), new Date(Date.now() + 1000))
  expect(clipStamp(collectClips([dir])[0])).not.toBe(before)
})
