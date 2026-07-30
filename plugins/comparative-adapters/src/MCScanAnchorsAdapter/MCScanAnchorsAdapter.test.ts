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

test('throws when no anchor joins at all', async () => {
  await expect(gets(makeInlineAdapter('nope1\tnope2\t10'))).rejects.toThrow(
    /name genes present in both BED files/,
  )
})
