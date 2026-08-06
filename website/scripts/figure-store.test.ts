/// <reference types="jest" />

/**
 * The figure store's pure half. Once figure bytes leave git, `figures.lock` is
 * the only record that a figure exists — so a manifest this module writes but
 * cannot read back, or a diff that misses a changed hash, does not fail loudly.
 * It publishes a site with figures silently missing, or reports "nothing moved"
 * over a regen that moved everything.
 *
 * imageSize is here for a narrower reason: it is the one part with a real
 * chance of being subtly wrong, because WebP has three container flavours and
 * sharp picks between them per image. A flavour parsed wrong reads as a
 * plausible number, not as a failure. (The parser was also cross-checked
 * against ImageMagick over all 48 committed .webp figures at adoption.)
 */
import {
  diffManifests,
  figureName,
  formatManifest,
  formatTextReport,
  imageSize,
  parseManifest,
  storeKey,
  storeUrl,
} from './figure-store.ts'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

const entry = (path: string, sha: string, bytes = 100, w = 10, h = 20) => ({
  path,
  sha256: sha,
  bytes,
  width: w,
  height: h,
})

test('a manifest round-trips through format and parse', () => {
  const entries = [
    entry('website/static/img/b.png', A, 1234, 800, 600),
    entry('website/static/img/a.png', B, 99, 100, 50),
  ]
  const parsed = parseManifest(formatManifest(entries))
  expect([...parsed.keys()]).toStrictEqual([
    'website/static/img/a.png',
    'website/static/img/b.png',
  ])
  expect(parsed.get('website/static/img/b.png')).toStrictEqual(entries[0])
})

test('formatting is sorted and canonical, so `check` can compare bytes', () => {
  const entries = [entry('z.png', A), entry('a.png', B)]
  const once = formatManifest(entries)
  expect(once).toBe(formatManifest([...entries].reverse()))
  expect(once).toBe(formatManifest([...parseManifest(once).values()]))
})

test('a figure with no parseable dimensions survives the round trip', () => {
  const text = formatManifest([
    { path: 'website/static/img/logo.svg', sha256: A, bytes: 40 },
  ])
  expect(text).toContain('website/static/img/logo.svg - 40 ')
  expect(parseManifest(text).get('website/static/img/logo.svg')).toStrictEqual({
    path: 'website/static/img/logo.svg',
    sha256: A,
    bytes: 40,
  })
})

test('a malformed line throws rather than dropping a figure', () => {
  expect(() => parseManifest('a.png 10x10 500')).toThrow(/malformed/)
})

test('comments and blank lines are ignored', () => {
  expect(parseManifest(`# header\n\na.png - 5 ${A}\n`).size).toBe(1)
})

test('diff separates added, changed and removed', () => {
  const before = parseManifest(
    `old.png - 1 ${A}\nsame.png - 1 ${A}\nmoved.png - 1 ${A}\n`,
  )
  const after = parseManifest(
    `new.png - 1 ${B}\nsame.png - 1 ${A}\nmoved.png - 2 ${B}\n`,
  )
  expect(diffManifests(before, after).map(c => [c.path, c.kind])).toStrictEqual(
    [
      ['moved.png', 'changed'],
      ['new.png', 'added'],
      ['old.png', 'removed'],
    ],
  )
})

test('a figure whose bytes are unchanged is not a change', () => {
  const m = parseManifest(`a.png 1x1 1 ${A}\n`)
  expect(diffManifests(m, parseManifest(`a.png 1x1 1 ${A}\n`))).toStrictEqual(
    [],
  )
})

test('the report calls out a resize, which no pixel diff can see', () => {
  const before = parseManifest(`website/static/img/x.png 1400x900 1000 ${A}\n`)
  const after = parseManifest(`website/static/img/x.png 1400x1240 2000 ${B}\n`)
  const text = formatTextReport(diffManifests(before, after), { base: 'main' })
  expect(text).toContain('resized 1400×900 → 1400×1240')
  expect(text).toContain('1 kB → 2 kB (+100%)')
})

test('a store key names the figure, then a short hash, then the extension', () => {
  const e = { path: 'website/static/img/hic/overlay.webp', sha256: A }
  expect(storeKey(e)).toBe('jb2-figures/hic/overlay.aaaaaaaaaaaa.webp')
  expect(storeUrl(e)).toBe(
    'https://jbrowse.org/jb2-figures/hic/overlay.aaaaaaaaaaaa.webp',
  )
})

test('two revisions of one figure differ only in the hash segment', () => {
  const path = 'website/static/img/insertion.png'
  const [before, after] = [
    storeKey({ path, sha256: A }),
    storeKey({ path, sha256: B }),
  ]
  expect(before).toBe('jb2-figures/insertion.aaaaaaaaaaaa.png')
  expect(after).toBe('jb2-figures/insertion.bbbbbbbbbbbb.png')
  // Which is the property that makes truncation safe: a short hash only has to
  // be unique among revisions of THIS figure, not across the whole store.
  expect(before).not.toBe(after)
})

test('a figure is named the way a doc and a reviewer name it', () => {
  expect(figureName('website/static/img/hic/overlay.png')).toBe('hic/overlay')
  expect(figureName('products/jbrowse-img/img/1.png')).toBe('jbrowse-img/1')
})

// --- imageSize ------------------------------------------------------------

function png(w: number, h: number) {
  const buf = Buffer.alloc(24)
  buf.write('IHDR', 12, 'latin1')
  buf.writeUInt32BE(w, 16)
  buf.writeUInt32BE(h, 20)
  return buf
}

function webp(fourcc: string, fill: (buf: Buffer) => void) {
  const buf = Buffer.alloc(40)
  buf.write('RIFF', 0, 'latin1')
  buf.write('WEBP', 8, 'latin1')
  buf.write(fourcc, 12, 'latin1')
  fill(buf)
  return buf
}

test('png dimensions come off IHDR', () => {
  expect(imageSize(png(1400, 1240))).toStrictEqual({
    width: 1400,
    height: 1240,
  })
})

test('all three webp flavours parse, since sharp picks between them', () => {
  const extended = webp('VP8X', b => {
    b.writeUIntLE(1199, 24, 3)
    b.writeUIntLE(599, 27, 3)
  })
  const lossy = webp('VP8 ', b => {
    b.writeUInt16LE(1200, 26)
    b.writeUInt16LE(600, 28)
  })
  const lossless = webp('VP8L', b => {
    b[20] = 0x2f
    b.writeUInt32LE(1199 | (599 << 14), 21)
  })
  for (const buf of [extended, lossy, lossless]) {
    expect(imageSize(buf)).toStrictEqual({ width: 1200, height: 600 })
  }
})

test('gif and jpeg parse; an unknown format reports no dimensions', () => {
  const gif = Buffer.alloc(10)
  gif.write('GIF89a', 0, 'latin1')
  gif.writeUInt16LE(320, 6)
  gif.writeUInt16LE(240, 8)
  expect(imageSize(gif)).toStrictEqual({ width: 320, height: 240 })

  // SOI, then one skipped APP0 segment, then SOF0 carrying h/w.
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]),
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x40, 0x01, 0x40]),
  ])
  expect(imageSize(jpeg)).toStrictEqual({ width: 320, height: 576 })

  expect(imageSize(Buffer.from('<svg/>'))).toStrictEqual({})
})
