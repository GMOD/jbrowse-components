import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './MCScanAnchorsAdapter.ts'
import configSchema from './configSchema.ts'

test('adapter can fetch features from mcscan anchors file', async () => {
  const adapter = new Adapter(
    configSchema.create({
      mcscanAnchorsLocation: {
        localPath: require.resolve('./test_data/grape.peach.anchors.gz'),
        locationType: 'LocalPathLocation',
      },
      bed1Location: {
        localPath: require.resolve('./test_data/grape.bed.gz'),
        locationType: 'LocalPathLocation',
      },
      bed2Location: {
        localPath: require.resolve('./test_data/peach.bed.gz'),
        locationType: 'LocalPathLocation',
      },

      assemblyNames: ['grape', 'peach'],
    }),
  )

  const features1 = adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(7)
  expect(fa2.length).toBe(8)
})

function makeInlineAdapter(anchors: string) {
  const dir = mkdtempSync(join(tmpdir(), 'mcscan-anchors-'))
  const write = (name: string, text: string) => {
    const path = join(dir, name)
    writeFileSync(path, `${text}\n`)
    return { localPath: path, locationType: 'LocalPathLocation' as const }
  }
  return new Adapter(
    configSchema.create({
      bed1Location: write('a.bed', 'chr1\t100\t200\tg1\t0\t+'),
      bed2Location: write('b.bed', 'ctgA\t500\t600\tg2\t0\t-'),
      mcscanAnchorsLocation: write('in.anchors', anchors),
      assemblyNames: ['grape', 'peach'],
    }),
  )
}

const gets = (adapter: Adapter) =>
  firstValueFrom(
    adapter
      .getFeatures({
        refName: 'chr1',
        start: 0,
        end: 10000,
        assemblyName: 'grape',
      })
      .pipe(toArray()),
  )

// an anchors file naming a gene the BED lacks (a filtered BED, a stale run) is
// one undrawable row; it used to throw and take the whole track with it
test('skips an anchor whose gene is missing from the BED', async () => {
  const fa = await gets(
    makeInlineAdapter(['g1\tg2\t100', 'g1\tmissing\t50'].join('\n')),
  )
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('score')).toBe(100)
  // inverted pair: + gene against a - gene
  expect(fa[0]!.get('strand')).toBe(-1)
})

// MCScanX is as often run on one genome, whose duplicated blocks pair it with
// itself. That loads as a self-alignment track: one BED on both sides and the
// assembly named twice, which the synteny view puts on both of its rows.
test('serves a self-alignment naming one assembly twice', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcscan-self-'))
  const bed = join(dir, 'grape.bed')
  writeFileSync(bed, 'chr1\t100\t200\tg1\t0\t+\nchr2\t500\t600\tg2\t0\t-\n')
  const anchors = join(dir, 'grape.grape.anchors')
  writeFileSync(anchors, '###\ng1\tg2\t100\n')
  const location = (localPath: string) => ({
    localPath,
    locationType: 'LocalPathLocation' as const,
  })
  const adapter = new Adapter(
    configSchema.create({
      bed1Location: location(bed),
      bed2Location: location(bed),
      mcscanAnchorsLocation: location(anchors),
      assemblyNames: ['grape', 'grape'],
    }),
  )
  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'chr1',
        start: 0,
        end: 10000,
        assemblyName: 'grape',
      })
      .pipe(toArray()),
  )
  expect(feats.length).toBe(1)
  expect(feats[0]!.get('assemblyName')).toBe('grape')
  // the duplicate copy rides along as the mate, on the same assembly and on the
  // other chromosome, which is what the second row of the view draws
  expect(feats[0]!.get('mate')).toMatchObject({
    assemblyName: 'grape',
    refName: 'chr2',
    name: 'g2',
  })

  // the block's other copy answers too, with the first as its mate. Both sides
  // of a self-alignment are the queried assembly, so keying off the first
  // matching one left the second copy of every duplication undrawable.
  const other = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'chr2',
        start: 0,
        end: 10000,
        assemblyName: 'grape',
      })
      .pipe(toArray()),
  )
  expect(other.length).toBe(1)
  expect(other[0]!.get('name')).toBe('g2')
  expect(other[0]!.get('mate')).toMatchObject({ refName: 'chr1', name: 'g1' })
  expect(other[0]!.id()).not.toBe(feats[0]!.id())
  expect(await adapter.getRefNames({ assemblyName: 'grape' })).toEqual([
    'chr1',
    'chr2',
  ])
})

// a row without a usable score column is a missing value, not a NaN: `+score`
// on an absent column put NaN on the feature and into the detail panel, which
// is the same case parseBed already guards for the BED's own score column
test('falls back to the BED score when the anchors row has none', async () => {
  const fa = await gets(makeInlineAdapter(['g1\tg2', 'g1\tg2\t.'].join('\n')))
  expect(fa.length).toBe(2)
  expect(fa.map(f => f.get('score'))).toEqual([0, 0])
})

test('throws when no anchor joins at all', async () => {
  await expect(gets(makeInlineAdapter('nope1\tnope2\t10'))).rejects.toThrow(
    /name genes present in both BED files/,
  )
})
