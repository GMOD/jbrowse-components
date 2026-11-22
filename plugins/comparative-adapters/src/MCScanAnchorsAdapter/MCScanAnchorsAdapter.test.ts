import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

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

// A tandem pair in grape against one peach gene, beside a one-to-one ortholog.
// The same pair named in two blocks still counts once.
test('each link carries its syntenic depth', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcscan-depth-'))
  const write = (name: string, text: string) => {
    const path = join(dir, name)
    writeFileSync(path, `${text}\n`)
    return { localPath: path, locationType: 'LocalPathLocation' as const }
  }
  const adapter = new Adapter(
    configSchema.create({
      bed1Location: write(
        'a.bed',
        [
          'chr1\t100\t200\tg1\t0\t+',
          'chr1\t300\t400\tg1b\t0\t+',
          'chr1\t900\t1000\tg3\t0\t+',
        ].join('\n'),
      ),
      bed2Location: write(
        'b.bed',
        ['ctgA\t500\t600\tg2\t0\t+', 'ctgA\t700\t800\tg4\t0\t+'].join('\n'),
      ),
      mcscanAnchorsLocation: write(
        'in.anchors',
        [
          '###',
          'g1\tg2\t100',
          'g1b\tg2\t90',
          'g3\tg4\t80',
          '###',
          'g1\tg2\t70',
        ].join('\n'),
      ),
      assemblyNames: ['grape', 'peach'],
    }),
  )
  const fa = await gets(adapter)
  expect(fa.map(f => [f.get('name'), f.get('syntenicDepth')])).toEqual([
    ['g1', 2],
    ['g1b', 2],
    ['g3', 1],
    ['g1', 2],
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

// An assembly neither side carries has the same answer whatever the rows say,
// so it must not read the file: this used to download and parse the anchors
// file and both BEDs to return []. Locations that cannot be opened are how the
// test sees that no read happened.
test('an assembly this adapter has no side for is answered without reading', async () => {
  const missing = {
    localPath: '/nonexistent/never-read',
    locationType: 'LocalPathLocation' as const,
  }
  const adapter = new Adapter(
    configSchema.create({
      bed1Location: missing,
      bed2Location: missing,
      mcscanAnchorsLocation: missing,
      assemblyNames: ['grape', 'peach'],
    }),
  )
  await expect(adapter.getRefNames({})).resolves.toEqual([])
  await expect(adapter.getRefNames({ assemblyName: 'mouse' })).resolves.toEqual(
    [],
  )
})

function inlineAdapter(files: {
  bed1: string[]
  bed2: string[]
  anchors: string[]
}) {
  const dir = mkdtempSync(join(tmpdir(), 'mcscan-blocks-'))
  const write = (name: string, lines: string[]) => {
    const path = join(dir, name)
    writeFileSync(path, `${lines.join('\n')}\n`)
    return { localPath: path, locationType: 'LocalPathLocation' as const }
  }
  return new Adapter(
    configSchema.create({
      bed1Location: write('a.bed', files.bed1),
      bed2Location: write('b.bed', files.bed2),
      mcscanAnchorsLocation: write('in.anchors', files.anchors),
      assemblyNames: ['grape', 'peach'],
    }),
  )
}

const genes = (refName: string, names: string[]) =>
  names.map(
    (name, i) =>
      `${refName}\t${(i + 1) * 100}\t${(i + 1) * 100 + 50}\t${name}\t0\t+`,
  )

const sixAgainstFour = {
  bed1: genes('chr1', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']),
  bed2: genes('ctgA', ['b1', 'b2', 'b3', 'b4']),
}

// Block 0 runs a1..a6 against b1..b4 with its extreme genes on neither the
// first nor the last row and b3 unpaired, so its shorter side is peach's 4
// genes; block 2 runs a2..a4 against b1..b4, so its shorter side is grape's 3.
// A pair above the first ### has no block, and block 1, whose only pair names
// a gene no BED has, still takes its number.
test("each pair carries its ### section and that block's shorter gene span", async () => {
  const fa = await gets(
    inlineAdapter({
      ...sixAgainstFour,
      anchors: [
        'a5\tb3\t10',
        '###',
        'a3\tb2\t10',
        'a1\tb1\t10',
        'a6\tb4\t10',
        '###',
        'a5\tmissing\t10',
        '###',
        'a2\tb1\t10',
        'a4\tb4\t10',
      ],
    }),
  )
  expect(
    fa.map(f => [f.get('name'), f.get('block'), f.get('blockSpan')]),
  ).toEqual([
    ['a5', undefined, undefined],
    ['a3', 'block0', 4],
    ['a1', 'block0', 4],
    ['a6', 'block0', 4],
    ['a2', 'block2', 3],
    ['a4', 'block2', 3],
  ])
})

test('### lines move no ids, and a file without them carries no block', async () => {
  const pairs = ['a3\tb2\t10', 'a1\tb1\t10', 'a2\tb1\t10']
  const ids = (fa: Awaited<ReturnType<typeof gets>>) =>
    fa.map(f => [f.id(), f.get('syntenyId')])
  const plain = await gets(inlineAdapter({ ...sixAgainstFour, anchors: pairs }))
  const sectioned = await gets(
    inlineAdapter({
      ...sixAgainstFour,
      anchors: ['###', pairs[0]!, pairs[1]!, '###', pairs[2]!],
    }),
  )
  expect(ids(sectioned)).toEqual(ids(plain))
  expect(ids(plain)).toEqual([
    ['0-0', 0],
    ['0-1', 1],
    ['0-2', 2],
  ])
  expect(plain.map(f => [f.get('block'), f.get('blockSpan')])).toEqual([
    [undefined, undefined],
    [undefined, undefined],
    [undefined, undefined],
  ])
})

// The 17 blocks touching peach chrG7 (NC_034015.1) 17-20 Mb in
// jbrowse.org/demos/grape_peach_cacao, each BED cut to the genes inside those
// blocks. The `.simple` rows are jcvi's own `screen --minspan=30` of them.
test('blockSpan >= 30 keeps the blocks jcvi screens at minspan 30', async () => {
  const local = (name: string) => ({
    localPath: require.resolve(`./test_data/${name}`),
    locationType: 'LocalPathLocation' as const,
  })
  const adapter = new Adapter(
    configSchema.create({
      mcscanAnchorsLocation: local('chrG7.anchors.gz'),
      bed1Location: local('chrG7.grape.bed.gz'),
      bed2Location: local('chrG7.peach.bed.gz'),
      assemblyNames: ['grape', 'peach'],
    }),
  )
  const peach = (start: number, end: number) =>
    firstValueFrom(
      adapter
        .getFeatures({
          refName: 'NC_034015.1',
          start,
          end,
          assemblyName: 'peach',
        })
        .pipe(toArray()),
    )
  const wide = (fa: Awaited<ReturnType<typeof peach>>) =>
    fa.filter(f => Number(f.get('blockSpan')) >= 30)
  const blocks = (fa: Awaited<ReturnType<typeof peach>>) =>
    new Set(fa.map(f => f.get('block')))

  const inWindow = await peach(17_000_000, 20_000_000)
  expect(inWindow.length).toBe(489)
  expect(blocks(inWindow).size).toBe(17)
  expect(blocks(wide(inWindow)).size).toBe(9)
  expect(wide(inWindow).length).toBe(433)

  const all = await peach(0, 2 ** 31)
  const wideBlocks = blocks(wide(all))
  const screened = gunzipSync(
    readFileSync(require.resolve('./test_data/chrG7.anchors.simple.gz')),
  )
    .toString()
    .trim()
    .split('\n')
    .map(line => line.split('\t')[2])
  expect(screened.length).toBe(9)
  expect(
    screened.filter(gene =>
      all.some(f => f.get('name') === gene && wideBlocks.has(f.get('block'))),
    ),
  ).toEqual(screened)
  expect(wideBlocks.size).toBe(screened.length)
})
