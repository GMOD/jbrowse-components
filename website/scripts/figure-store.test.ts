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
  compareToBaseline,
  diffManifests,
  figureName,
  figurePath,
  formatManifest,
  formatTextReport,
  imageSize,
  mergeManifest,
  parseManifest,
  resolveNow,
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

// mergeManifest decides which lines survive a push, and every way of getting it
// wrong deletes figures from the only record that they exist — silently, since a
// manifest is valid at any size and the bytes stay in the store. The damage
// surfaces one `pull` later, as a site built with images missing.
test('an unfiltered merge writes the worktree, dropping what is gone', () => {
  const before = parseManifest(`a.png - 1 ${A}\ngone.png - 1 ${A}\n`)
  const merged = mergeManifest(before, [entry('a.png', B)], [])
  expect([...merged.keys()]).toStrictEqual(['a.png'])
  expect(merged.get('a.png')?.sha256).toBe(B)
})

test('a filtered merge updates its selection and carries the rest through', () => {
  const before = parseManifest(
    `website/static/img/wolf.png 10x20 1 ${A}\n` +
      `website/static/img/other.png 10x20 1 ${A}\n`,
  )
  const merged = mergeManifest(
    before,
    [entry('website/static/img/wolf.png', B)],
    ['wolf'],
  )
  expect(merged.size).toBe(2)
  expect(merged.get('website/static/img/wolf.png')?.sha256).toBe(B)
  // byte-identical to the old line, not re-derived: this is the half that makes
  // a one-figure push safe in a worktree holding somebody else's regen
  expect(merged.get('website/static/img/other.png')).toStrictEqual(
    before.get('website/static/img/other.png'),
  )
})

test('a filtered merge still drops a selected figure that left the disk', () => {
  const before = parseManifest(
    `website/static/img/wolf.png - 1 ${A}\nwebsite/static/img/other.png - 1 ${A}\n`,
  )
  const merged = mergeManifest(before, [], ['wolf'])
  expect([...merged.keys()]).toStrictEqual(['website/static/img/other.png'])
})

// figureName is not injective: jb2export renders to products/jbrowse-img/img and
// the website keeps a mirror of every one. They are copies and have to move
// together, so one token selecting both paths is the behaviour we want here.
test('a filter token selects both paths a figure name maps to', () => {
  const before = parseManifest(
    `products/jbrowse-img/img/insertion.png - 1 ${A}\n` +
      `website/static/img/insertion.png - 1 ${A}\n` +
      `website/static/img/unrelated.png - 1 ${A}\n`,
  )
  const merged = mergeManifest(
    before,
    [
      entry('products/jbrowse-img/img/insertion.png', B),
      entry('website/static/img/insertion.png', B),
    ],
    ['insertion'],
  )
  expect(merged.size).toBe(3)
  expect(merged.get('products/jbrowse-img/img/insertion.png')?.sha256).toBe(B)
  expect(merged.get('website/static/img/insertion.png')?.sha256).toBe(B)
  expect(merged.get('website/static/img/unrelated.png')?.sha256).toBe(A)
})

// --exact is what the end-of-run push hint emits, because a spec name is often a
// substring of another figure's name. The mirrored pair still moves together
// under it, and that is not luck: both paths normalize to the one name.
test('an exact filter takes the mirrored pair but not a longer neighbour', () => {
  const before = parseManifest(
    `products/jbrowse-img/img/insertion.png - 1 ${A}\n` +
      `website/static/img/jbrowse-img/insertion.png - 1 ${A}\n` +
      `website/static/img/insertion_expanded.png - 1 ${A}\n`,
  )
  expect(
    [...before.keys()]
      .map(figureName)
      .filter(n => n === 'jbrowse-img/insertion').length,
  ).toBe(2)
  const merged = mergeManifest(
    before,
    [
      entry('products/jbrowse-img/img/insertion.png', B),
      entry('website/static/img/jbrowse-img/insertion.png', B),
    ],
    ['jbrowse-img/insertion'],
    true,
  )
  expect(merged.size).toBe(3)
  expect(merged.get('products/jbrowse-img/img/insertion.png')?.sha256).toBe(B)
  expect(
    merged.get('website/static/img/jbrowse-img/insertion.png')?.sha256,
  ).toBe(B)
  // the substring neighbour is untouched, which is the whole reason for --exact
  expect(merged.get('website/static/img/insertion_expanded.png')?.sha256).toBe(
    A,
  )
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

/**
 * `resolveNow` is what `report` diffs a base ref against, and both of its two
 * jobs failed silently the one time each was missing. Reporting against the
 * lock alone hides a regen nobody has pushed, which is the state you are in
 * whenever you want to look at a figure. Reporting against the worktree alone
 * calls every figure removed on push.yml, which runs `report` on a plain
 * checkout with no sweep and no `figures:pull`, where gitignored figure bytes
 * mean nothing is on disk at all.
 */
describe('resolveNow', () => {
  const lock = new Map([
    ['website/static/img/a.png', entry('website/static/img/a.png', A)],
    ['website/static/img/b.png', entry('website/static/img/b.png', A)],
  ])

  test('with nothing on disk it is the manifest, so push.yml is unchanged', () => {
    const now = resolveNow(lock, [])
    expect(now).toStrictEqual(lock)
    expect(diffManifests(lock, now)).toStrictEqual([])
  })

  test('bytes on disk win, so an unpushed regen is visible', () => {
    const regen = entry('website/static/img/a.png', B, 222)
    const changes = diffManifests(lock, resolveNow(lock, [regen]))
    expect(changes).toStrictEqual([
      {
        path: 'website/static/img/a.png',
        kind: 'changed',
        before: lock.get('website/static/img/a.png'),
        after: regen,
      },
    ])
  })

  test('a figure only on disk is added, and the untouched ones stay quiet', () => {
    const fresh = entry('website/static/img/c.png', B)
    const changes = diffManifests(lock, resolveNow(lock, [fresh]))
    expect(changes).toStrictEqual([
      { path: 'website/static/img/c.png', kind: 'added', after: fresh },
    ])
  })

  test('a partial checkout mixes the two per file', () => {
    const onDisk = entry('website/static/img/b.png', B)
    const now = resolveNow(lock, [onDisk])
    expect(now.get('website/static/img/a.png')).toBe(
      lock.get('website/static/img/a.png'),
    )
    expect(now.get('website/static/img/b.png')).toBe(onDisk)
  })
})

// The review UI's baseline. It compared a branch against origin/main by running
// `git ls-tree`/`git diff`/`git show` over website/static/img — which the move
// to the store gitignored, so every one of those commands matched nothing. Git
// asked about an untracked path does not answer "unchanged", it answers "no such
// figure", and the two are the same silence: all 314 cards read "new", none read
// "changed", and the whole origin/main column said "not on origin/main" for
// months without a single error.
//
// So what is pinned here is the join. A card is a name, the manifest is keyed by
// path, and a lookup that produces a key the manifest does not have degrades to
// exactly that silence rather than to a failure.
describe('a card against its baseline', () => {
  // Keyed by literal path, the way figures.lock is, and NOT by figurePath():
  // fixtures built with the function under test are self-consistent, so a key
  // that drifts away from the manifest's shape still matches itself and every
  // assertion passes. That is the same self-agreement that let the git-based
  // baseline look fine — it, too, was consistent with itself and with nothing.
  const disk = new Map([
    ['website/static/img/same.png', entry('website/static/img/same.png', A)],
    [
      // resized as well as regenerated, so the two sides' sizes are told apart
      'website/static/img/moved.png',
      entry('website/static/img/moved.png', B, 300, 900, 600),
    ],
    ['website/static/img/added.png', entry('website/static/img/added.png', B)],
  ])
  const base = new Map([
    ['website/static/img/same.png', entry('website/static/img/same.png', A)],
    [
      'website/static/img/moved.png',
      entry('website/static/img/moved.png', A, 200, 800, 600),
    ],
    ['website/static/img/gone.png', entry('website/static/img/gone.png', A)],
  ])
  const missing = new Set(['website/static/img/gone.png'])
  const compare = (name: string) =>
    compareToBaseline(figurePath(name), disk, base, missing)

  test('an unchanged figure is not "new", and carries a baseline picture', () => {
    // the assertion the dead baseline could not have passed: mainUrl present
    // and changed false, rather than absent and everything flagged new
    expect(compare('same')).toStrictEqual({
      exists: true,
      unpulled: false,
      changed: false,
      mainUrl: storeUrl(entry('website/static/img/same.png', A)),
      size: [10, 20],
      mainSize: [10, 20],
    })
  })

  test('a regenerated figure is changed, and its BEFORE url is the old sha', () => {
    const c = compare('moved')
    expect(c.changed).toBe(true)
    // the point of the store baseline: the before-image is the superseded
    // revision, still at its own immutable url, not the bytes now on disk
    expect(c.mainUrl).toBe(storeUrl(entry('website/static/img/moved.png', A)))
    expect(c.mainUrl).not.toBe(
      storeUrl(entry('website/static/img/moved.png', B)),
    )
    // and the sizes the page reserves each column with come from the side they
    // name — swapping them would reserve the wrong box for both
    expect(c.size).toEqual([900, 600])
    expect(c.mainSize).toEqual([800, 600])
  })

  test('a figure the branch added has no baseline to show', () => {
    expect(compare('added')).toStrictEqual({
      exists: true,
      unpulled: false,
      changed: false,
      size: [10, 20],
    })
  })

  test('an unpulled figure is told apart from one that needs regenerating', () => {
    // both are "no picture on the card", and they have opposite fixes:
    // figures:pull for the first, a regen for the second
    expect(compare('gone').unpulled).toBe(true)
    expect(compare('never-existed').unpulled).toBe(false)
    expect(compare('never-existed').exists).toBe(false)
  })

  test('the name a card carries round-trips to the path the manifest keys', () => {
    // the two halves of the join, checked against each other. figureName is
    // lossy on purpose; figurePath is its inverse for the one root a card can
    // come from, and a card whose path misses is silently a card with no
    // baseline.
    for (const p of [
      'website/static/img/insertion.png',
      'website/static/img/hic/overlay_controls.png',
      'website/static/img/desktop-landing.png',
    ]) {
      expect(figurePath(figureName(p))).toBe(p)
      expect(base.has(figurePath(figureName(p)))).toBe(base.has(p))
    }
  })

  test('a mirrored jb2export figure is NOT reachable by name', () => {
    // figureName maps products/jbrowse-img/img/hic.png and the website's mirror
    // of it to one name, so anything keyed on the name conflates the pair. A
    // card is about the file the server serves, which is the mirror.
    const src = 'products/jbrowse-img/img/hic.png'
    const mirror = 'website/static/img/jbrowse-img/hic.png'
    expect(figureName(src)).toBe(figureName(mirror))
    expect(figurePath(figureName(src))).toBe(mirror)
  })
})
