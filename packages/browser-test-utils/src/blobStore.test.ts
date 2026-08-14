import {
  diffManifests,
  formatManifest,
  hashBuffer,
  imageSize,
  mergeManifest,
  parseManifest,
  storeKey,
  storeUrl,
} from './blobStore.ts'

import type { BlobCorpus, BlobEntry } from './blobStore.ts'

// The two real corpora, spelled here rather than imported: this file is about
// the grammar they SHARE, and importing either would make the test pass by
// construction if that corpus were the thing that broke.
const figures: BlobCorpus = {
  storePrefix: 'jb2-figures',
  name: p => p.replace('website/static/img/', '').replace(/\.\w+$/, ''),
  extRe: /\.(png|webp|jpe?g|gif|svg|ico)$/i,
}
const snapshots: BlobCorpus = {
  storePrefix: 'jb2-snapshots',
  name: p =>
    p
      .replace('products/jbrowse-web/browser-tests/__snapshots__/', '')
      .replace(/\.\w+$/, ''),
  extRe: /\.(png|svg)$/i,
}

const SHA = 'a'.repeat(64)

function entry(path: string, over: Partial<BlobEntry> = {}): BlobEntry {
  return { path, sha256: SHA, bytes: 10, ...over }
}

describe('the key grammar both corpora share', () => {
  test('is <prefix>/<name>.<hash12><ext>', () => {
    expect(storeKey(figures, entry('website/static/img/hic/x.png'))).toBe(
      `jb2-figures/hic/x.${'a'.repeat(12)}.png`,
    )
    expect(
      storeKey(
        snapshots,
        entry(
          'products/jbrowse-web/browser-tests/__snapshots__/canvas2d/t_arcs.png',
        ),
      ),
    ).toBe(`jb2-snapshots/canvas2d/t_arcs.${'a'.repeat(12)}.png`)
  })

  // The prefix is the whole separation between the two corpora. Without it a
  // golden and a figure sharing a name would share a key, and the second push
  // would be a no-op that silently served the first one's bytes.
  test('separates the corpora by prefix alone', () => {
    const a = storeKey(figures, entry('website/static/img/x.png'))
    const b = storeKey(
      snapshots,
      entry('products/jbrowse-web/browser-tests/__snapshots__/x.png'),
    )
    expect(a).not.toBe(b)
    expect(a.startsWith('jb2-figures/')).toBe(true)
    expect(b.startsWith('jb2-snapshots/')).toBe(true)
  })

  test('lower-cases the extension, so .PNG and .png are one key', () => {
    expect(storeKey(figures, entry('website/static/img/X.PNG'))).toBe(
      `jb2-figures/X.${'a'.repeat(12)}.png`,
    )
  })

  test('storeUrl is the key under the public host', () => {
    expect(storeUrl(figures, entry('website/static/img/x.png'))).toBe(
      `https://jbrowse.org/jb2-figures/x.${'a'.repeat(12)}.png`,
    )
  })
})

describe('the manifest line both lock files use', () => {
  test('round-trips, dimensions and all', () => {
    const entries = [
      entry('b.png', { width: 3, height: 4, bytes: 12 }),
      entry('a.svg', { bytes: 7 }),
    ]
    const back = parseManifest(formatManifest(entries, '# h\n'), 'x.lock')
    expect(back.get('a.svg')).toEqual({ path: 'a.svg', sha256: SHA, bytes: 7 })
    expect(back.get('b.png')).toEqual({
      path: 'b.png',
      sha256: SHA,
      bytes: 12,
      width: 3,
      height: 4,
    })
  })

  // Sorted by path in code-point order, because the file is checked in: two
  // machines writing it have to agree or it churns on its own.
  test('sorts by path and keeps the header', () => {
    const text = formatManifest(
      [entry('b.png'), entry('A.png'), entry('a.png')],
      '# header\n',
    )
    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('# header')
    expect(lines.slice(1).map(l => l.split(' ')[0])).toEqual([
      'A.png',
      'a.png',
      'b.png',
    ])
  })

  test('names the lock file when a line is malformed', () => {
    expect(() => parseManifest('a.png 1x1\n', 'snapshots.lock')).toThrow(
      /snapshots\.lock/,
    )
  })

  test('a dimensionless entry writes and reads back as -', () => {
    expect(formatManifest([entry('a.svg')], '')).toContain('a.svg - 10 ')
  })
})

describe('mergeManifest', () => {
  const before = new Map([
    ['x.png', entry('x.png')],
    ['y.png', entry('y.png')],
  ])
  const nameOf = (p: string) => p.replace('.png', '')
  const matches = (name: string, toks: string[]) => toks.includes(name)

  // The destructive-in-one-direction case the function exists for: a filtered
  // push must not drop the lines it did not select.
  test('carries through the lines a filter did not name', () => {
    const after = mergeManifest(
      before,
      [entry('x.png', { sha256: 'b'.repeat(64) })],
      ['x'],
      matches,
      nameOf,
    )
    expect([...after.keys()].sort()).toEqual(['x.png', 'y.png'])
    expect(after.get('x.png')!.sha256).toBe('b'.repeat(64))
    expect(after.get('y.png')!.sha256).toBe(SHA)
  })

  test('unfiltered, the result is exactly what was selected', () => {
    const after = mergeManifest(before, [entry('z.png')], [], matches, nameOf)
    expect([...after.keys()]).toEqual(['z.png'])
  })
})

describe('diffManifests', () => {
  test('reports added, changed and removed, sorted by path', () => {
    const before = new Map([
      ['keep.png', entry('keep.png')],
      ['gone.png', entry('gone.png')],
      ['moved.png', entry('moved.png')],
    ])
    const after = new Map([
      ['keep.png', entry('keep.png')],
      ['moved.png', entry('moved.png', { sha256: 'c'.repeat(64) })],
      ['new.png', entry('new.png')],
    ])
    expect(diffManifests(before, after).map(c => [c.path, c.kind])).toEqual([
      ['gone.png', 'removed'],
      ['moved.png', 'changed'],
      ['new.png', 'added'],
    ])
  })
})

describe('imageSize', () => {
  test('reads a PNG header', () => {
    const buf = Buffer.alloc(24)
    buf.write('IHDR', 12, 'latin1')
    buf.writeUInt32BE(1400, 16)
    buf.writeUInt32BE(900, 20)
    expect(imageSize(buf)).toEqual({ width: 1400, height: 900 })
  })

  // Not a failure — svg and ico have no header this parses, and the manifest
  // writes `-` for them rather than a guess.
  test('answers nothing for a format it does not parse', () => {
    expect(imageSize(Buffer.from('<svg/>'))).toEqual({})
  })
})

test('hashBuffer is sha256 hex', () => {
  expect(hashBuffer(Buffer.from('abc'))).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})
